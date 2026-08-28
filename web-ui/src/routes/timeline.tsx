import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import {
	Bird,
	ChartNoAxesColumnIncreasing,
	Clock3,
	Feather,
	LayoutGrid,
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
	TIMELINE_PERIOD_LABELS,
	TIMELINE_PERIODS,
	type TimelinePeriod,
} from "~/lib/timeline-periods.ts";
import { formatTimelineShareCard } from "~/lib/timeline-share.ts";
import { currentAnchor, isValidAnchor } from "~/lib/timeline-window.ts";
import { cn } from "~/lib/utils.ts";

const DEFAULT_PERIOD: TimelinePeriod = "day";

/**
 * Which body to draw for the window: the species x hour heat map, or the grid
 * of everything heard. Only one shows at a time; the other is a click away on
 * the view toggle. Lives in the URL alongside period and date so a link carries
 * the whole view, not just the window.
 */
const TIMELINE_VIEWS = ["hours", "grid"] as const;
type TimelineView = (typeof TIMELINE_VIEWS)[number];
const DEFAULT_VIEW: TimelineView = "hours";

const timelineSearchSchema = z.object({
	period: z
		.enum(TIMELINE_PERIODS)
		.default(DEFAULT_PERIOD)
		.catch(DEFAULT_PERIOD),
	view: z.enum(TIMELINE_VIEWS).default(DEFAULT_VIEW).catch(DEFAULT_VIEW),
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
		middlewares: [
			stripSearchParams({ period: DEFAULT_PERIOD, view: DEFAULT_VIEW }),
		],
	},
	loaderDeps: ({ search }) => ({
		period: search.period,
		anchor: resolveAnchor(search.period, search.date),
	}),
	loader: ({ deps }) => getTimelinePage({ data: deps }),
	component: Timeline,
});

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/**
 * The day masthead drops the weekday the shared window label carries -- the
 * "Daily" eyebrow above it already says what kind of window this is, so
 * "Thu, " only crowds the date. UTC to match every other timeline label.
 */
const DAY_TITLE = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC",
});

function Timeline() {
	const data = Route.useLoaderData();
	const search = Route.useSearch();
	const { period, view } = search;
	const anchor = resolveAnchor(period, search.date);
	const navigate = Route.useNavigate();

	const show = (next: {
		period?: TimelinePeriod;
		date?: string;
		view?: TimelineView;
	}) => navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });

	// A date the station could never have recorded is the one case with nothing
	// to say at all -- no figures, no window, no grid -- so it replaces the page
	// rather than sitting inside it.
	if (data.body.kind === "day-out-of-range") {
		return <OutOfRangeDay result={data.body.result} date={anchor} />;
	}

	return (
		<TooltipProvider>
			<div className="page-wrap space-y-4 py-4">
				<TimelineHeader
					data={data}
					period={period}
					anchor={anchor}
					view={view}
					onChange={show}
				/>

				{/* A station with nothing recorded has no window picker and no
				    figures, so every card below would be an empty shell with one
				    line in it. The page-level treatment replaces them outright
				    rather than nesting a card inside a card. */}
				{data.hasAnyDetections ? (
					<TimelineCards
						rows={data.body.rows}
						windowLabel={data.window?.label ?? null}
						view={view}
						onViewChange={(next) => show({ view: next })}
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
 * The masthead for every period: the standard page header, with the selected
 * window as the title, the granularity named beneath it, and the share control
 * set against the title -- over the figures that say what the page is showing
 * about that window.
 */
function TimelineHeader({
	data,
	period,
	anchor,
	view,
	onChange,
}: {
	data: TimelinePageData;
	period: TimelinePeriod;
	anchor: string;
	view: TimelineView;
	onChange: (next: { period?: TimelinePeriod; date?: string }) => void;
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
			title={headerTitle(data, period, anchor)}
			description={VIEW_META[view].description}
			stats={windowStats(rows)}
			action={data.hasAnyDetections ? share.trigger : undefined}
			// Between the title and the figures, so the window it picks reads as
			// steering the figures beneath it. Gated on the station rather than the
			// window: an empty week still needs the switcher to reach a window with
			// something in it.
			afterHeader={
				data.hasAnyDetections ? (
					<PeriodToolbar
						period={period}
						anchor={anchor}
						window={data.window}
						prevAnchor={data.prevAnchor}
						nextAnchor={data.nextAnchor}
						lastActiveDay={data.lastActiveDay}
						stationRange={data.stationRange}
						onChange={onChange}
					/>
				) : undefined
			}
		>
			{share.summary}
		</PageHeaderCard>
	);
}

/**
 * The page's title: the scope, then the window -- "Daily — Aug 26, 2026". "all"
 * has no window to name, so it stops at the scope ("All Time"); every other
 * period appends the window label the picker moves through.
 *
 * The week label carries its own range dash (an en dash). Stepped down here to a
 * hyphen so it reads as subordinate to the em dash that splits scope from
 * window, rather than a second separator of the same weight sitting beside it.
 */
function headerTitle(
	data: TimelinePageData,
	period: TimelinePeriod,
	anchor: string,
): string {
	const scope = TIMELINE_PERIOD_LABELS[period];
	if (period === "all") return scope;
	const window =
		period === "day"
			? DAY_TITLE.format(new Date(`${anchor}T00:00:00Z`))
			: (data.window?.label ?? anchor);
	return `${scope} — ${window.replace(/–/g, "-")}`;
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
 * The window's body, one view at a time: either when each species was active
 * across the window's hours, or the grid of everything heard in it. The toggle
 * above swaps between them -- the same rows, drawn two ways, so only the one
 * you asked for takes up the page.
 */
function TimelineCards({
	rows,
	windowLabel,
	view,
	onViewChange,
}: {
	rows: TimelineRow[];
	windowLabel: string | null;
	view: TimelineView;
	onViewChange: (next: TimelineView) => void;
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
		hourCounts: row.hourCounts,
	}));

	const toggle = <ViewToggle view={view} onViewChange={onViewChange} />;

	return view === "hours" ? (
		<SpeciesByHourCard
			rows={rows}
			newLabel={windowLabel}
			emptyMessage={emptyMessage}
			action={toggle}
		/>
	) : (
		<SpeciesGrid
			species={gridItems}
			newLabel={windowLabel}
			emptyMessage={emptyMessage}
			action={toggle}
		/>
	);
}

const VIEW_META: Record<
	TimelineView,
	{
		label: string;
		icon: React.ComponentType<{ className?: string }>;
		/** The masthead subtitle when this view is showing -- says what the body
		 * below draws, since the scope has moved up into the title. */
		description: string;
	}
> = {
	hours: {
		label: "By-hour heat map",
		icon: Clock3,
		description: "When each species was heard, hour by hour",
	},
	grid: {
		label: "Grid",
		icon: LayoutGrid,
		description: "Every species heard — how often, and how sure",
	},
};

/**
 * Picks which body the window draws -- set against the card's title, top-right.
 * A pair of icon buttons sized to the kicker beside them, not the page's chunky
 * segmented control: the active one takes the card's own sage wash rather than a
 * moss fill, so the switch reads as part of the card's furniture, not a toolbar
 * dropped into its corner. The glyphs carry the labels (tooltip + a11y name).
 */
function ViewToggle({
	view,
	onViewChange,
}: {
	view: TimelineView;
	onViewChange: (next: TimelineView) => void;
}) {
	return (
		<div className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-[var(--line)] bg-card p-0.5">
			{TIMELINE_VIEWS.map((value) => {
				const { label, icon: Icon } = VIEW_META[value];
				const active = value === view;
				return (
					<button
						key={value}
						type="button"
						aria-pressed={active}
						aria-label={label}
						title={label}
						onClick={() => !active && onViewChange(value)}
						className={cn(
							"flex size-6 items-center justify-center rounded-sm transition-colors",
							active
								? "text-[var(--moss)]"
								: "text-muted-foreground hover:bg-[var(--meadow)] hover:text-foreground",
						)}
						style={
							active
								? {
										backgroundColor:
											"color-mix(in oklab, var(--sage) 45%, var(--paper-raised))",
									}
								: undefined
						}
					>
						<Icon className="size-3.5" />
					</button>
				);
			})}
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
