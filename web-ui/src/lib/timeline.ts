import { and, lt, sql } from "drizzle-orm";

import { db } from "~/db/index.ts";
import { detections } from "~/db/schema.ts";
import { ebirdUrlFor } from "~/lib/ebird.ts";
import { illustrationUrlFor } from "~/lib/illustrations.ts";
import { RARE_LIFETIME_MAX } from "~/lib/story-data.ts";
import type { TimelinePeriod } from "~/lib/timeline-periods.ts";
import {
	anchorForDay,
	type TimelineAnchor,
	type TimelineWindow,
	windowFor,
} from "~/lib/timeline-window.ts";
import { getSpeciesInfo } from "~/lib/wikipedia.ts";

/**
 * Calendar windows, not rolling ones: "Weekly" means a specific Mon-Sun week
 * the picker names, so the page can be stepped through history rather than
 * only ever showing the trailing N hours.
 */
export type TimelineRequest = {
	period: TimelinePeriod;
	/** Ignored when the period is "all". See {@link TimelineAnchor}. */
	anchor: TimelineAnchor;
};

export type TimelineRow = {
	comName: string;
	sciName: string;
	imageUrl: string | null;
	ebirdUrl: string;
	totalDetections: number;
	hourCounts: number[];
	/**
	 * The station had never recorded this species before the window opened, so
	 * this window is where it first arrived. Always false on "all time", where
	 * every species is trivially first heard inside the window.
	 */
	isNew: boolean;
	/** Mean detection confidence across this window, 0–1. Null when the window
	    holds no scored detections for the species. */
	averageConfidence: number | null;
	/**
	 * A rare visitor here: its lifetime detection count at this station is at or
	 * below RARE_LIFETIME_MAX, regardless of the selected window. Matches the
	 * threshold the Live story card uses.
	 */
	isRare: boolean;
};

export type TimelineData = {
	rows: TimelineRow[];
	/** The resolved window, or null on "all time". */
	window: TimelineWindow | null;
	/**
	 * Anchors for the nearest neighbouring windows that actually hold
	 * detections, so the step arrows always land on something. Null when there
	 * is nothing further in that direction, which is what disables the arrow --
	 * this skips over silent stretches instead of walking the user through them.
	 */
	prevAnchor: TimelineAnchor | null;
	nextAnchor: TimelineAnchor | null;
	/**
	 * The day a period switch re-anchors on: the latest one inside this window
	 * that holds detections, or the nearest one outside it when the window is
	 * empty. Anchoring on the window's own start instead would drop Yearly onto
	 * January 1st -- a dead month for most stations -- so the switch follows the
	 * data. Null only when the station has never recorded anything.
	 */
	lastActiveDay: string | null;
	/**
	 * First and last day the station ever recorded, used to bound the picker.
	 * Null when it has never recorded anything.
	 */
	stationRange: { first: string; last: string } | null;
	/**
	 * Whether the station has ever recorded anything, regardless of the selected
	 * window. An empty window is not the same as an empty station -- the page
	 * needs the difference so it only hides the switcher when there is genuinely
	 * nothing to switch to.
	 */
	hasAnyDetections: boolean;
};

/**
 * Where a window sits in the station's history: what it can step to, what a
 * period switch should re-anchor on, and how far the picker may range. Every
 * period-scoped view needs this, including the day view -- which loads its
 * body from `day.ts` and would otherwise have no way to draw the toolbar
 * above it -- so it lives on its own rather than inside the rows query.
 */
export type TimelineNav = Pick<
	TimelineData,
	| "window"
	| "prevAnchor"
	| "nextAnchor"
	| "lastActiveDay"
	| "stationRange"
	| "hasAnyDetections"
>;

export async function loadTimelineNav(
	period: TimelinePeriod,
	window: TimelineWindow | null,
): Promise<TimelineNav> {
	const [[neighbours], [stationBounds]] = await Promise.all([
		// The nearest recorded day on either side of the window (what the step
		// arrows snap to) and the latest one inside it (what a period switch
		// re-anchors on), in a single pass over the dates.
		window
			? db
					.select({
						prev: sql<
							string | null
						>`max(case when ${detections.Date} < ${window.start} then ${detections.Date} end)`,
						next: sql<
							string | null
						>`min(case when ${detections.Date} > ${window.end} then ${detections.Date} end)`,
						inside: sql<
							string | null
						>`max(case when ${detections.Date} between ${window.start} and ${window.end} then ${detections.Date} end)`,
					})
					.from(detections)
			: Promise.resolve([{ prev: null, next: null, inside: null }]),
		db
			.select({
				first: sql<string | null>`min(${detections.Date})`,
				last: sql<string | null>`max(${detections.Date})`,
			})
			.from(detections),
	]);

	return {
		window,
		prevAnchor: neighbours.prev ? anchorForDay(period, neighbours.prev) : null,
		nextAnchor: neighbours.next ? anchorForDay(period, neighbours.next) : null,
		// Preferring what's inside the window keeps the switch where the user is
		// looking; the neighbours only stand in for an empty window, so changing
		// granularity can't strand them somewhere with nothing to show. "All
		// time" spans everything, making the station's last day its own.
		lastActiveDay: window
			? (neighbours.inside ?? neighbours.next ?? neighbours.prev)
			: stationBounds.last,
		stationRange:
			stationBounds.first && stationBounds.last
				? { first: stationBounds.first, last: stationBounds.last }
				: null,
		hasAnyDetections: stationBounds.first !== null,
	};
}

/**
 * Plain-function form, so `timeline-page.ts` can compose the rows with the extra
 * queries a period needs without paying for a second round trip.
 */
export async function loadTimelineData({
	period,
	anchor,
}: TimelineRequest): Promise<TimelineData> {
	const window = windowFor(period, anchor);
	const inWindow = window
		? and(
				sql`${detections.Date} >= ${window.start}`,
				sql`${detections.Date} <= ${window.end}`,
			)
		: undefined;

	const [rows, previouslySeenRows, confidenceRows, lifetimeRows, nav] =
		await Promise.all([
			db
				.select({
					comName: detections.Com_Name,
					sciName: detections.Sci_Name,
					hour: sql<string>`strftime('%H', ${detections.Time})`,
					count: sql<number>`count(*)`,
				})
				.from(detections)
				.where(inWindow)
				.groupBy(
					detections.Com_Name,
					detections.Sci_Name,
					sql`strftime('%H', ${detections.Time})`,
				),
			// Everything the station knew before this window opened; a species
			// missing from it is one the window introduced. "All time" has no
			// "before" to compare against and skips the probe.
			window
				? db
						.selectDistinct({ comName: detections.Com_Name })
						.from(detections)
						.where(lt(detections.Date, window.start))
				: Promise.resolve([]),
			// Mean confidence per species inside the window.
			db
				.select({
					comName: detections.Com_Name,
					avgConfidence: sql<number | null>`avg(${detections.Confidence})`,
				})
				.from(detections)
				.where(inWindow)
				.groupBy(detections.Com_Name),
			// Lifetime detection count per species, ignoring the window: what makes
			// a species a rare visitor here at all.
			db
				.select({
					comName: detections.Com_Name,
					lifetime: sql<number>`count(*)`,
				})
				.from(detections)
				.groupBy(detections.Com_Name),
			loadTimelineNav(period, window),
		]);

	const bySpecies = new Map<
		string,
		{ comName: string; sciName: string; hourCounts: number[] }
	>();
	for (const row of rows) {
		let entry = bySpecies.get(row.comName);
		if (!entry) {
			entry = {
				comName: row.comName,
				sciName: row.sciName,
				hourCounts: Array(24).fill(0),
			};
			bySpecies.set(row.comName, entry);
		}
		entry.hourCounts[Number(row.hour)] = row.count;
	}

	const previouslySeen = new Set(previouslySeenRows.map((row) => row.comName));

	const avgConfidenceByName = new Map(
		confidenceRows.map((row) => [row.comName, row.avgConfidence]),
	);
	const lifetimeByName = new Map(
		lifetimeRows.map((row) => [row.comName, row.lifetime]),
	);

	const withImages = await Promise.all(
		Array.from(bySpecies.values()).map(async (entry) => {
			const { imageUrl: wikiImageUrl } = await getSpeciesInfo(entry.comName);
			const totalDetections = entry.hourCounts.reduce((a, b) => a + b, 0);
			return {
				comName: entry.comName,
				sciName: entry.sciName,
				imageUrl: illustrationUrlFor(entry.sciName) ?? wikiImageUrl,
				ebirdUrl: ebirdUrlFor(entry.sciName, entry.comName),
				totalDetections,
				hourCounts: entry.hourCounts,
				isNew: window !== null && !previouslySeen.has(entry.comName),
				averageConfidence: avgConfidenceByName.get(entry.comName) ?? null,
				isRare: (lifetimeByName.get(entry.comName) ?? 0) <= RARE_LIFETIME_MAX,
			};
		}),
	);

	return {
		rows: withImages.sort((a, b) => b.totalDetections - a.totalDetections),
		...nav,
	};
}
