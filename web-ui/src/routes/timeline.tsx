import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import {
	Bird,
	ChartNoAxesColumnIncreasing,
	Clock3,
	Feather,
} from "lucide-react";
import { z } from "zod";
import { DetectionsByHourCard } from "~/components/detections-by-hour-card.tsx";
import { DetectionsByMonthCard } from "~/components/detections-by-month-card.tsx";
import { EmptyState } from "~/components/empty-state.tsx";
import {
	PageHeaderCard,
	type PageHeaderStat,
} from "~/components/page-header-card.tsx";
import {
	type SpeciesActivityItem,
	SpeciesActivityList,
} from "~/components/species-activity-list.tsx";
import { SpeciesByHourCard } from "~/components/species-by-hour-card.tsx";
import { SpeciesList } from "~/components/species-list.tsx";
import { StatusPage } from "~/components/status-page.tsx";
import {
	DayReviewBody,
	formatDayTitle,
	standingLabel,
} from "~/components/timeline/day-review.tsx";
import { PeriodToolbar } from "~/components/timeline/period-toolbar.tsx";
import { TooltipProvider } from "~/components/ui/tooltip.tsx";
import { useShareCard } from "~/components/use-share-card.tsx";
import type { DayReview } from "~/lib/day.ts";
import { getDayShareCard } from "~/lib/day-share.ts";
import {
	ARRIVAL_WINDOW_DAYS,
	QUIET_AFTER_DAYS,
	RESIDENT_MIN_DAYS,
	shortDateLabel,
} from "~/lib/migration-data.ts";
import { pageTitle } from "~/lib/page-title.ts";
import { formatShareCard } from "~/lib/share-card.ts";
import { hourLabel } from "~/lib/time-ago.ts";
import type { TimelineRow } from "~/lib/timeline.ts";
import {
	getTimelinePage,
	type TimelineBody,
	type TimelinePageData,
} from "~/lib/timeline-page.ts";
import {
	TIMELINE_PERIODS,
	type TimelinePeriod,
} from "~/lib/timeline-periods.ts";
import { formatTimelineShareCard } from "~/lib/timeline-share.ts";
import { currentAnchor, isValidAnchor } from "~/lib/timeline-window.ts";

const DEFAULT_PERIOD: TimelinePeriod = "week";

const timelineSearchSchema = z.object({
	period: z
		.enum(TIMELINE_PERIODS)
		.default(DEFAULT_PERIOD)
		.catch(DEFAULT_PERIOD),
	/**
	 * Which window of the period to show, in that period's own notation (see
	 * TimelineAnchor). Absent means the one containing today, so a bare
	 * /timeline link stays current instead of freezing on whatever day it was
	 * written.
	 */
	// Coerced, not plain string: a bare year in a hand-written link
	// (?date=2019) parses as a number, and rejecting it would silently snap the
	// page back to today.
	date: z.coerce.string().optional().catch(undefined),
});

/**
 * Falls back to today's window when the URL names none, and to today's window
 * again when it holds an anchor left over from a different period (switching
 * Monthly -> Daily mid-navigation) or plain garbage.
 *
 * The day period is the exception: it is the one scope that can tell you *why*
 * a date is unusable -- not a date at all, still ahead, or before the station
 * was listening -- so a value it cannot read travels on to be judged rather
 * than being silently swapped for today. Quietly showing a different day than
 * the address asked for is the worse failure.
 */
function resolveAnchor(period: TimelinePeriod, date: string | undefined) {
	if (!date) return currentAnchor(period);
	if (isValidAnchor(period, date)) return date;
	return period === "day" ? date : currentAnchor(period);
}

export const Route = createFileRoute("/timeline")({
	head: () => ({ meta: [{ title: pageTitle("Timeline") }] }),
	validateSearch: timelineSearchSchema,
	search: {
		middlewares: [stripSearchParams({ period: DEFAULT_PERIOD })],
	},
	loaderDeps: ({ search }) => ({
		period: search.period,
		anchor: resolveAnchor(search.period, search.date),
	}),
	loader: ({ deps }) => getTimelinePage({ data: deps }),
	component: Timeline,
});

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function Timeline() {
	const data = Route.useLoaderData();
	const search = Route.useSearch();
	const { period } = search;
	const anchor = resolveAnchor(period, search.date);
	const navigate = Route.useNavigate();

	const show = (next: { period?: TimelinePeriod; date?: string }) =>
		navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });

	// A date the station could never have recorded is the one case with nothing
	// to say at all -- no figures, no window, no grid -- so it replaces the page
	// rather than sitting inside it.
	if (data.body.kind === "day" && data.body.result.status !== "ok") {
		return <OutOfRangeDay result={data.body.result} date={anchor} />;
	}

	return (
		<TooltipProvider>
			<div className="page-wrap space-y-4 py-4">
				<TimelineHeader data={data} period={period} anchor={anchor} />

				{/* Gated on the station rather than the window: an empty week still
				    needs the switcher to reach a window that has something in it. */}
				{data.hasAnyDetections && (
					<PeriodToolbar
						period={period}
						anchor={anchor}
						window={data.window}
						prevAnchor={data.prevAnchor}
						nextAnchor={data.nextAnchor}
						lastActiveDay={data.lastActiveDay}
						stationRange={data.stationRange}
						onChange={show}
					/>
				)}

				{/* A station with nothing recorded has no window picker and no
				    figures, so every card below would be an empty shell with one
				    line in it. The page-level treatment replaces them outright
				    rather than nesting a card inside a card. */}
				{data.hasAnyDetections ? (
					<TimelineCards
						body={data.body}
						window={data.window?.label ?? null}
						anchor={anchor}
					/>
				) : (
					<EmptyState icon={Bird} title="No detections recorded yet.">
						Once the station hears something, its rhythm will show up here --
						hour by hour, day by day, and across the whole of its history.
					</EmptyState>
				)}
			</div>
		</TooltipProvider>
	);
}

/**
 * One masthead for every period. The title never changes; the sentence under
 * it and the figures beside it are what say which window you are looking
 * through, which is why the four pages this replaced no longer need four
 * different headings.
 */
function TimelineHeader({
	data,
	period,
	anchor,
}: {
	data: TimelinePageData;
	period: TimelinePeriod;
	anchor: string;
}) {
	const day = data.body.kind === "day" ? dayOf(data.body) : null;

	const share = useShareCard({
		// Named by what's showing, so switching period or stepping to another
		// week rebuilds the card instead of leaving the last one behind the
		// button.
		subject: `${period}:${anchor}`,
		load: async () =>
			day
				? formatShareCard(await getDayShareCard({ data: day.date }))
				: formatTimelineShareCard({
						period,
						windowLabel: data.window?.label ?? null,
						rows: rowsOf(data.body),
					}),
	});

	return (
		<PageHeaderCard
			title="Timeline"
			description={describe(data, period)}
			stats={headerStats(data.body)}
			// Kept on screen for empty windows too -- the card says so in a line,
			// and a control that vanished as you stepped through quiet weeks would
			// shift the masthead under the cursor.
			action={data.hasAnyDetections ? share.trigger : undefined}
		>
			{share.summary}
		</PageHeaderCard>
	);
}

/**
 * The same four figures in the same order under every period: detections,
 * species, busiest hour, most active. The window changes what they measure,
 * never what they are -- a masthead that reshuffled itself as you stepped from
 * Daily to All Time would read as four different pages again, which is the
 * thing this page exists to undo.
 *
 * Four numbers and nothing else. Every sub-line these used to carry -- the
 * count behind the busiest hour, the count behind the most active bird, the
 * day's comparison against a typical one -- said something already available
 * further down the page, in a size that made the row look ragged before it
 * made it informative.
 */
function headerStats(body: TimelineBody): PageHeaderStat[] {
	if (body.kind === "day") {
		const day = dayOf(body);
		return day ? dayStats(day) : [];
	}
	return windowStats(body.rows);
}

/** The sentence that says which window the figures below belong to. */
function describe(data: TimelinePageData, period: TimelinePeriod): string {
	if (data.body.kind === "day") {
		const day = dayOf(data.body);
		if (!day) return "One day at this station, hour by hour.";
		const standing = day.standing
			? ` · ${standingLabel(day.standing, day)}`
			: "";
		return `${formatDayTitle(day.date)} · ${day.relativeLabel}${standing}`;
	}

	if (period === "all") {
		return "Every detection this station has recorded, and what stands out in it.";
	}

	return data.window
		? `${data.window.label} — when each species was active, hour by hour.`
		: "When each species is active across the day, hour by hour.";
}

function dayOf(body: TimelineBody): DayReview | null {
	return body.kind === "day" && body.result.status === "ok"
		? body.result.day
		: null;
}

function rowsOf(body: TimelineBody): TimelineRow[] {
	return body.kind === "day" ? [] : body.rows;
}

/**
 * The day's figures come from the day review rather than the grid -- it is the
 * one period whose body is not built from timeline rows -- but they answer the
 * same four questions in the same order.
 */
function dayStats(day: DayReview): PageHeaderStat[] {
	const { summary } = day;
	// The list is ranked, so the day's most active species is simply its first
	// row.
	const topRow = day.species[0] ?? null;

	return [
		{
			label: "Detections",
			value: summary.detections,
			icon: ChartNoAxesColumnIncreasing,
		},
		{ label: "Species", value: summary.species, icon: Feather },
		{
			label: "Busiest hour",
			value: summary.busiestHour ? hourLabel(summary.busiestHour.hour) : "—",
			icon: Clock3,
		},
		{
			label: "Most active",
			value: topRow ? topRow.comName : "—",
			icon: Bird,
		},
	];
}

/**
 * Every figure is derived from the already period-scoped rows, so the header
 * moves with the period toggle without a second round trip.
 */
function windowStats(rows: TimelineRow[]): PageHeaderStat[] {
	// An empty window keeps all four figures as em dashes rather than dropping
	// the row. Collapsing the masthead would shift the switcher and the picker
	// up the page underneath the cursor, mid-click, exactly when stepping into a
	// quiet window makes you most likely to click again.
	if (rows.length === 0) {
		return [
			{ label: "Detections", value: "—", icon: ChartNoAxesColumnIncreasing },
			{ label: "Species", value: "—", icon: Feather },
			{ label: "Busiest hour", value: "—", icon: Clock3 },
			{ label: "Most active", value: "—", icon: Bird },
		];
	}

	const detections = rows.reduce((sum, row) => sum + row.totalDetections, 0);

	const hourTotals = HOURS.map((hour) =>
		rows.reduce((sum, row) => sum + (row.hourCounts[hour] ?? 0), 0),
	);
	const peakHour = hourTotals.reduce(
		(best, count, hour) => (count > hourTotals[best] ? hour : best),
		0,
	);
	const hasPeak = hourTotals[peakHour] > 0;

	const topRow = rows.reduce<TimelineRow | null>(
		(best, row) =>
			best && best.totalDetections >= row.totalDetections ? best : row,
		null,
	);

	return [
		{
			label: "Detections",
			value: detections,
			icon: ChartNoAxesColumnIncreasing,
		},
		{ label: "Species", value: rows.length, icon: Feather },
		{
			label: "Busiest hour",
			value: hasPeak ? hourLabel(peakHour) : "—",
			icon: Clock3,
		},
		{
			label: "Most active",
			value: topRow ? topRow.comName : "—",
			icon: Bird,
		},
	];
}

/**
 * What each period puts under the toolbar. The species-by-hour grid is the one
 * card every window shares; everything else earns its place by needing a
 * window of a particular size to mean anything.
 */
function TimelineCards({
	body,
	window,
	anchor,
}: {
	body: TimelineBody;
	window: string | null;
	anchor: string;
}) {
	if (body.kind === "day") {
		const day = dayOf(body);
		return day ? <DayReviewBody day={day} /> : null;
	}

	const emptyMessage = window
		? `No detections recorded for ${window}.`
		: "No detections recorded in this window.";

	return (
		<>
			<SpeciesByHourCard
				rows={body.rows}
				newLabel={window}
				emptyMessage={emptyMessage}
			/>

			{body.kind === "window" && body.trend ? (
				<DetectionsByMonthCard trend={body.trend} year={Number(anchor)} />
			) : null}

			{body.kind === "all" ? <AllTimeCards stats={body.stats} /> : null}
		</>
	);
}

/**
 * The cards that need the station's whole history as their baseline. A ranking
 * or a migration list scoped to one week is not a shorter version of itself --
 * it is noise, which is why these appear under "All time" alone.
 */
function AllTimeCards({
	stats,
}: {
	stats: Extract<TimelineBody, { kind: "all" }>["stats"];
}) {
	// Both lists date their rows by the marker detection each one stands on --
	// the last one heard, or the first of an arrival.
	const quietItems: SpeciesActivityItem[] = stats.quietSpecies.map((item) => ({
		comName: item.comName,
		sciName: item.sciName,
		imageUrl: item.imageUrl,
		detectedAt: item.detectedAt,
		ageMs: item.ageMs,
		timeLabel: shortDateLabel(item.lastSeen),
		confidence: item.confidence,
		audioUrl: item.audioUrl,
	}));

	const arrivalItems: SpeciesActivityItem[] = stats.newArrivals.map((item) => ({
		comName: item.comName,
		sciName: item.sciName,
		imageUrl: item.imageUrl,
		detectedAt: item.detectedAt,
		ageMs: item.ageMs,
		timeLabel: shortDateLabel(item.firstSeen),
		confidence: item.confidence,
		audioUrl: item.audioUrl,
	}));

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
			<DetectionsByHourCard activity={stats.hourActivity} />
			{/* No min-height: the two lists sit in the same grid row, so they
			    already stretch to match each other. Reserving height instead only
			    padded them with dead space until the lists were long enough. */}
			<SpeciesList title="Top species" species={stats.topSpeciesList} />
			<SpeciesList title="Rarest species" species={stats.rarestSpeciesList} />
			<SpeciesActivityList
				title="New arrivals"
				description={`Species heard in the last ${ARRIVAL_WINDOW_DAYS} days that were absent for the ${ARRIVAL_WINDOW_DAYS} days before that — new sightings and returning migrants alike.`}
				species={arrivalItems}
				emptyMessage="No new arrivals in the last two weeks."
			/>
			<SpeciesActivityList
				title="Gone quiet"
				description={`Regular visitors — heard on at least ${RESIDENT_MIN_DAYS} separate days — with no detection in the last ${QUIET_AFTER_DAYS} days. They may have migrated away or shifted territory.`}
				species={quietItems}
				emptyMessage="Every regular visitor has been heard recently."
			/>
		</div>
	);
}

const TIMELINE_SECTION = "Timeline";
const TIMELINE_SECTION_DESCRIPTION =
	"What this station heard, at whatever scale you ask for.";

/**
 * A date outside the station's history. Not a page with empty cards on it: the
 * window itself is the thing that does not exist, so there is nothing to scope
 * and nothing to draw.
 */
function OutOfRangeDay({
	result,
	date,
}: {
	result: Extract<TimelineBody, { kind: "day" }>["result"];
	date: string;
}) {
	switch (result.status) {
		case "future":
			return (
				<StatusPage
					section={TIMELINE_SECTION}
					sectionDescription={TIMELINE_SECTION_DESCRIPTION}
					tone="missing"
					title="That day hasn't happened yet"
				>
					{formatDayTitle(date)} is still ahead. There is nothing to review
					until the station has heard it.
				</StatusPage>
			);
		case "before-station":
			return (
				<StatusPage
					section={TIMELINE_SECTION}
					sectionDescription={TIMELINE_SECTION_DESCRIPTION}
					tone="missing"
					title="Before this station started listening"
				>
					{formatDayTitle(date)} predates the first recording. This station has
					been listening since {formatDayTitle(result.firstRecorded)}.
				</StatusPage>
			);
		default:
			return (
				<StatusPage
					section={TIMELINE_SECTION}
					sectionDescription={TIMELINE_SECTION_DESCRIPTION}
					tone="missing"
					title="That isn't a date"
				>
					“{date}” isn’t a valid date. Dates look like 2025-04-19.
				</StatusPage>
			);
	}
}
