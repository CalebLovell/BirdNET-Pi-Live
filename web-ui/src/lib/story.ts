import { createServerFn } from "@tanstack/react-start";
import { count, sql } from "drizzle-orm";

import { db } from "~/db/index.ts";
import { detections } from "~/db/schema.ts";
import { illustrationUrlFor } from "~/lib/illustrations.ts";
import { detectedAt, isLast24h } from "~/lib/now.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";
import {
	buildStory,
	RARE_LIFETIME_MAX,
	RETURN_AFTER_DAYS,
	ROUTINE_MIN_DAYS,
	ROUTINE_SILENT_DAYS,
	STORY_SPECIES_LIMIT,
	type StoryLine,
	type StorySpecies,
} from "~/lib/story-data.ts";
import { timestampToMillis } from "~/lib/visits.ts";
import { getSpeciesInfo } from "~/lib/wikipedia.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The fortnight the baseline averages over. It ends where the 24-hour window
 * begins, hence the 15 days in `isBaseline` below: day -15 to day -1 is the
 * fourteen whole days before the window, with no overlap to double-count.
 */
const BASELINE_DAYS = 14;

/** Everything before the rolling 24-hour window the rest of the page uses. */
const isBeforeWindow = sql`${detectedAt} < datetime('now', '-24 hours', 'localtime')`;

/** The fortnight before the window: what "usual" means for this station. */
const isBaseline = sql`${detectedAt} >= datetime('now', '-15 days', 'localtime') and ${isBeforeWindow}`;

type SpeciesRow = { comName: string; sciName: string };

/** The same illustration-then-Wikipedia lookup every other species list uses. */
async function imageUrlFor({
	sciName,
	comName,
}: SpeciesRow): Promise<string | null> {
	return (
		illustrationUrlFor(sciName, "perched") ??
		(await getSpeciesInfo(comName)).imageUrl
	);
}

/**
 * Species rows ready for a story line.
 *
 * Only the first STORY_SPECIES_LIMIT of any list are ever named, so only those
 * are worth a Wikipedia lookup -- the tail exists purely to be counted into
 * "and N more", and carries no image because nothing will render one.
 */
async function withImages<Row extends SpeciesRow>(
	rows: Row[],
): Promise<(Row & StorySpecies)[]> {
	return Promise.all(
		rows.map(async (row, index) => ({
			...row,
			speciesSlug: comNameToSlug(row.comName),
			imageUrl: index < STORY_SPECIES_LIMIT ? await imageUrlFor(row) : null,
		})),
	);
}

/**
 * What the last 24 hours are worth saying, if anything.
 *
 * Deliberately not part of getNowSnapshot: the Today page repolls that every
 * ten seconds, and none of these judgements can change that fast. This runs
 * from the route loader alone, which is also what keeps its three full-table
 * scans off the polling path.
 */
export const getTodaysStory = createServerFn({ method: "GET" }).handler(
	async (): Promise<StoryLine[]> => {
		// One clock read for every age in the story, so two lines can never
		// disagree about how long a bird has been away.
		const nowMs = Date.now();

		const [windowRows, historyRows, [volume]] = await Promise.all([
			db
				.select({
					comName: detections.Com_Name,
					sciName: detections.Sci_Name,
					windowCount: count(),
				})
				.from(detections)
				.where(isLast24h)
				.groupBy(detections.Com_Name, detections.Sci_Name)
				.orderBy(sql`count(*) desc`),
			// Everything the rules need to know about life before the window, in
			// one grouped pass: how often a species has ever been heard, when it
			// was last heard, and how much of the last fortnight it was around for.
			db
				.select({
					comName: detections.Com_Name,
					sciName: detections.Sci_Name,
					countBefore: count(),
					lastBefore: sql<string>`max(${detectedAt})`,
					daysInFortnight: sql<number>`count(distinct case when ${isBaseline} then ${detections.Date} end)`,
				})
				.from(detections)
				.where(isBeforeWindow)
				.groupBy(detections.Com_Name, detections.Sci_Name),
			db
				.select({
					windowCount: sql<number>`count(case when ${isLast24h} then 1 end)`,
					baselineCount: sql<number>`count(case when ${isBaseline} then 1 end)`,
					allTimeCount: count(),
				})
				.from(detections),
		]);

		// A station that has never recorded anything has no story to tell, and an
		// encouraging card next to an empty hero only underlines the emptiness.
		if (!volume || volume.allTimeCount === 0) return [];

		const history = new Map(historyRows.map((row) => [row.comName, row]));
		const heardInWindow = new Set(windowRows.map((row) => row.comName));
		const daysSince = (timestamp: string) =>
			Math.floor((nowMs - timestampToMillis(timestamp)) / DAY_MS);

		const newRows = windowRows.filter((row) => !history.has(row.comName));

		const rareRows = windowRows
			.flatMap((row) => {
				const before = history.get(row.comName);
				// New species are their own, better line -- never also "rare".
				if (!before) return [];
				const lifetimeCount = before.countBefore + row.windowCount;
				return lifetimeCount <= RARE_LIFETIME_MAX
					? [{ ...row, lifetimeCount }]
					: [];
			})
			.sort((a, b) => a.lifetimeCount - b.lifetimeCount);

		// A bird with three records ever has almost certainly also been absent a
		// fortnight, so left alone these two lines name the same birds twice.
		// Rarity is the stronger claim -- a species that is barely ever here has
		// no routine to have broken -- so it takes the bird and returns gives it
		// up, which also stops one arrival being padded into two paragraphs.
		const isRare = new Set(rareRows.map((row) => row.comName));

		const returningRows = windowRows
			.flatMap((row) => {
				const before = history.get(row.comName);
				if (!before || isRare.has(row.comName)) return [];
				const daysAway = daysSince(before.lastBefore);
				return daysAway >= RETURN_AFTER_DAYS ? [{ ...row, daysAway }] : [];
			})
			.sort((a, b) => b.daysAway - a.daysAway);

		const routineRows = historyRows
			.flatMap((row) => {
				if (heardInWindow.has(row.comName)) return [];
				if (row.daysInFortnight < ROUTINE_MIN_DAYS) return [];
				const daysSilent = daysSince(row.lastBefore);
				return daysSilent >= ROUTINE_SILENT_DAYS
					? [{ ...row, daysSilent }]
					: [];
			})
			.sort((a, b) => b.daysInFortnight - a.daysInFortnight);

		const [newSpecies, returning, rare, breakingRoutine] = await Promise.all([
			withImages(newRows),
			withImages(returningRows),
			withImages(rareRows),
			withImages(routineRows),
		]);

		return buildStory({
			newSpecies,
			returning,
			rare,
			breakingRoutine,
			windowCount: volume.windowCount,
			baseline: volume.baselineCount / BASELINE_DAYS,
		});
	},
);
