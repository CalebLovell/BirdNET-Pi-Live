import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import {
	Bird,
	ChartNoAxesColumnIncreasing,
	Clock3,
	Feather,
} from "lucide-react";
import { z } from "zod";
import { EmptyState } from "~/components/empty-state.tsx";
import {
	PageHeaderCard,
	type PageHeaderStat,
} from "~/components/page-header-card.tsx";
import { SpeciesByHourCard } from "~/components/species-by-hour-card.tsx";
import {
	SpeciesGrid,
	type SpeciesGridItem,
} from "~/components/species-grid.tsx";
import { StatusPage } from "~/components/status-page.tsx";
import { PeriodToolbar } from "~/components/timeline/period-toolbar.tsx";
import { TooltipProvider } from "~/components/ui/tooltip.tsx";
import { useShareCard } from "~/components/use-share-card.tsx";
import { getDayShareCard } from "~/lib/day-share.ts";
import { formatDayTitle } from "~/lib/day-title.ts";
import { pageTitle } from "~/lib/page-title.ts";
import { formatShareCard } from "~/lib/share-card.ts";
import { hourLabel } from "~/lib/time-ago.ts";
import type { TimelineRow } from "~/lib/timeline.ts";
import {
	type DayOutOfRange,
	getTimelinePage,
	type TimelinePageData,
} from "~/lib/timeline-page.ts";
import {
	TIMELINE_PERIODS,
	type TimelinePeriod,
} from "~/lib/timeline-periods.ts";
import { formatTimelineShareCard } from "~/lib/timeline-share.ts";
import { currentAnchor, isValidAnchor } from "~/lib/timeline-window.ts";

const DEFAULT_PERIOD: TimelinePeriod = "day";

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
	if (data.body.kind === "day-out-of-range") {
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
						rows={data.body.rows}
						windowLabel={data.window?.label ?? null}
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
	const rows = data.body.kind === "rows" ? data.body.rows : [];

	const share = useShareCard({
		subject: `${period}:${anchor}`,
		load: async () =>
			period === "day"
				? formatShareCard(await getDayShareCard({ data: anchor }))
				: formatTimelineShareCard({
						period,
						windowLabel: data.window?.label ?? null,
						rows,
					}),
	});

	return (
		<PageHeaderCard
			title="Timeline"
			description={describe(data, period)}
			stats={windowStats(rows)}
			action={data.hasAnyDetections ? share.trigger : undefined}
		>
			{share.summary}
		</PageHeaderCard>
	);
}

/** The sentence that says which window the figures below belong to. */
function describe(data: TimelinePageData, period: TimelinePeriod): string {
	if (period === "all") {
		return "Every detection this station has recorded, and what stands out in it.";
	}
	return data.window
		? `${data.window.label} — when each species was active, hour by hour.`
		: "When each species is active across the day, hour by hour.";
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
 * The one body every period now shows: when each species was active across the
 * day, the shape of the whole window's activity by hour, and the grid of
 * everything heard in it.
 */
function TimelineCards({
	rows,
	windowLabel,
}: {
	rows: TimelineRow[];
	windowLabel: string | null;
}) {
	const emptyMessage = windowLabel
		? `No detections recorded for ${windowLabel}.`
		: "No detections recorded in this window.";

	const gridItems: SpeciesGridItem[] = rows.map((row) => ({
		comName: row.comName,
		sciName: row.sciName,
		imageUrl: row.imageUrl,
		count: row.totalDetections,
		averageConfidence: row.averageConfidence,
		isNew: row.isNew,
		isRare: row.isRare,
		isReturned: row.isReturned,
		returnedUnit: row.returnedUnit,
	}));

	return (
		<>
			<SpeciesByHourCard
				rows={rows}
				newLabel={windowLabel}
				emptyMessage={emptyMessage}
			/>
			<SpeciesGrid
				species={gridItems}
				newLabel={windowLabel}
				emptyMessage={emptyMessage}
			/>
		</>
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
	result: DayOutOfRange;
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
