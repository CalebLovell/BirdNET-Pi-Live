import {
	createFileRoute,
	Link,
	stripSearchParams,
} from "@tanstack/react-router";
import {
	Bird,
	Calendar,
	CalendarDays,
	CalendarRange,
	ChartNoAxesColumnIncreasing,
	ChevronLeft,
	ChevronRight,
	Clock,
	Clock3,
	Feather,
	Infinity as InfinityIcon,
	Sparkles,
} from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";

import {
	PageHeaderCard,
	type PageHeaderStat,
} from "~/components/page-header-card.tsx";
import { Input } from "~/components/ui/input.tsx";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group.tsx";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/components/ui/tooltip.tsx";
import { HEAT_COLORS, heatLevel } from "~/lib/heatmap.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";
import { getTimelineData, type TimelineRow } from "~/lib/timeline.ts";
import {
	TIMELINE_PERIOD_LABELS,
	TIMELINE_PERIODS,
	type TimelinePeriod,
} from "~/lib/timeline-periods.ts";
import {
	anchorForDay,
	currentAnchor,
	isValidAnchor,
	type TimelineAnchor,
} from "~/lib/timeline-window.ts";

const DEFAULT_PERIOD: TimelinePeriod = "week";

const timelineSearchSchema = z.object({
	period: z
		.enum(TIMELINE_PERIODS)
		.default(DEFAULT_PERIOD)
		.catch(DEFAULT_PERIOD),
	/**
	 * Which window of the period to show, in that period's own notation (see
	 * TimelineAnchor). Absent means the one containing today, so a bare /timeline
	 * link stays current instead of freezing on whatever day it was written.
	 */
	// Coerced, not plain string: a bare year in a hand-written link
	// (?date=2019) parses as a number, and rejecting it would silently snap the
	// page back to today.
	date: z.coerce.string().optional().catch(undefined),
});

/**
 * Falls back to today's window, and to today's window again when the URL holds
 * an anchor left over from a different period (switching Monthly -> Daily mid-
 * navigation) or plain garbage.
 */
function resolveAnchor(period: TimelinePeriod, date: string | undefined) {
	return date && isValidAnchor(period, date) ? date : currentAnchor(period);
}

export const Route = createFileRoute("/timeline")({
	validateSearch: timelineSearchSchema,
	search: {
		middlewares: [stripSearchParams({ period: DEFAULT_PERIOD })],
	},
	loaderDeps: ({ search }) => ({
		period: search.period,
		anchor: resolveAnchor(search.period, search.date),
	}),
	loader: ({ deps }) => getTimelineData({ data: deps }),
	component: Timeline,
});

const PERIOD_ICONS: Record<
	TimelinePeriod,
	React.ComponentType<{ className?: string }>
> = {
	day: Clock,
	week: CalendarDays,
	month: CalendarRange,
	year: Calendar,
	all: InfinityIcon,
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

// The hour columns share whatever the name column leaves over, so the cells
// stretch into rectangles on a wide card and fall back to their 26px floor
// (scrolling the card) once the viewport can't afford that.
const HOUR_GRID_COLUMNS = "16rem repeat(24, minmax(26px, 1fr))";

const HEADER_HEIGHT = "mb-2 h-4";
const ROW_HEIGHT = "h-8";

function hourTickParts(hour: number): { number: string; meridiem: string } {
	if (hour === 0) return { number: "12", meridiem: "a" };
	if (hour < 12) return { number: String(hour), meridiem: "a" };
	if (hour === 12) return { number: "12", meridiem: "p" };
	return { number: String(hour - 12), meridiem: "p" };
}

function hourLabel(hour: number): string {
	if (hour === 0) return "12 AM";
	if (hour < 12) return `${hour} AM`;
	if (hour === 12) return "12 PM";
	return `${hour - 12} PM`;
}

// The native input that fits each granularity. Chromium renders week and month
// as real pickers; elsewhere they degrade to text fields holding the same
// "2026-W31" / "2026-07" values, which still round-trip correctly.
const PICKER_TYPES: Record<Exclude<TimelinePeriod, "all">, string> = {
	day: "date",
	week: "week",
	month: "month",
	year: "number",
};

const PICKER_LABELS: Record<Exclude<TimelinePeriod, "all">, string> = {
	day: "Day",
	week: "Week",
	month: "Month",
	year: "Year",
};

function EmptyNote({ children }: { children: React.ReactNode }) {
	return <p className="mt-4 text-muted-foreground text-sm">{children}</p>;
}

function Timeline() {
	const {
		rows,
		hasAnyDetections,
		// Aliased: `window` would shadow the global inside this component.
		window: activeWindow,
		prevAnchor,
		nextAnchor,
		lastActiveDay,
		stationRange,
	} = Route.useLoaderData();
	const search = Route.useSearch();
	const { period } = search;
	const anchor = resolveAnchor(period, search.date);
	const navigate = Route.useNavigate();
	const isEmpty = rows.length === 0;
	// Naming the window only makes sense while the picker is on screen to
	// explain it; a station with nothing recorded just says so.
	const emptyMessage = !hasAnyDetections
		? "No detections recorded yet."
		: activeWindow
			? `No detections recorded for ${activeWindow.label}.`
			: "No detections recorded yet.";

	const show = (next: Partial<{ period: TimelinePeriod; date: string }>) =>
		navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });
	// The chart bodies need the kicker's bottom margin; the empty note brings its
	// own top margin, so keeping both would double the gap.
	const kickerClass = isEmpty ? "island-kicker" : "island-kicker mb-4";

	// Every figure is derived from the already period-scoped rows, so the
	// header moves with the period toggle without a second round trip.
	const stats = useMemo<PageHeaderStat[]>(() => {
		// An empty window keeps all four figures as em dashes rather than dropping
		// the row. Collapsing the masthead would shift the switcher and the picker
		// up the page underneath the cursor, mid-click, exactly when stepping into
		// a quiet window makes you most likely to click again.
		if (rows.length === 0) {
			return [
				{ label: "Species", value: "—", icon: Feather },
				{ label: "Detections", value: "—", icon: ChartNoAxesColumnIncreasing },
				{ label: "Busiest hour", value: "—", icon: Clock3 },
				{ label: "Most active", value: "—", icon: Bird },
			] satisfies PageHeaderStat[];
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
			{ label: "Species", value: rows.length, icon: Feather },
			{
				label: "Detections",
				value: detections,
				icon: ChartNoAxesColumnIncreasing,
			},
			{
				label: "Busiest hour",
				value: hasPeak ? hourLabel(peakHour) : "—",
				detail: hasPeak
					? `${hourTotals[peakHour].toLocaleString()} detections`
					: undefined,
				icon: Clock3,
			},
			{
				label: "Most active",
				value: topRow ? topRow.comName : "—",
				detail: topRow
					? `${topRow.totalDetections.toLocaleString()} detections`
					: undefined,
				icon: Bird,
			},
		] satisfies PageHeaderStat[];
	}, [rows]);

	return (
		<div className="page-wrap space-y-4 py-4">
			<PageHeaderCard
				title="Timeline"
				description="When each species is active across the day, hour by hour."
				stats={stats}
			/>

			{/* Gated on the station rather than the window: an empty week still
			    needs the switcher to reach a window that has something in it. */}
			{hasAnyDetections && (
				<div className="flex flex-wrap items-center justify-between gap-3">
					<ToggleGroup
						type="single"
						variant="outline"
						value={period}
						onValueChange={(value) => {
							if (!value) return;
							const next = value as TimelinePeriod;
							// Carry the spot in history across the switch, anchored on the
							// last day of the current window that holds detections. Using the
							// window's start instead would drop Annually onto January 1st and
							// land the user in a dead month; falling back to it only matters
							// when the current window is empty anyway.
							const carried = lastActiveDay ?? activeWindow?.start;
							show({
								period: next,
								date:
									next === "all" || !carried
										? undefined
										: anchorForDay(next, carried),
							});
						}}
					>
						{TIMELINE_PERIODS.map((p) => {
							const Icon = PERIOD_ICONS[p];
							return (
								<ToggleGroupItem key={p} value={p}>
									<Icon className="size-4" />
									{TIMELINE_PERIOD_LABELS[p]}
								</ToggleGroupItem>
							);
						})}
					</ToggleGroup>

					{period !== "all" && (
						<WindowPicker
							period={period}
							anchor={anchor}
							stationRange={stationRange}
							prevAnchor={prevAnchor}
							nextAnchor={nextAnchor}
							onPick={(date) => show({ date })}
						/>
					)}
				</div>
			)}

			<TooltipProvider>
				<section
					aria-label="Detections by hour"
					className="feature-card rounded-md p-4"
				>
					<div className={kickerClass}>Detections by hour</div>
					{isEmpty ? (
						<EmptyNote>{emptyMessage}</EmptyNote>
					) : (
						<div className="-m-1 overflow-x-auto p-1">
							{/* p-1/-m-1 cancel out visually, but the padding gives the first
							    column's focus ring somewhere to draw: the row links sit flush
							    against the scrollport, so a 2px offset outline would be
							    clipped on its left edge without the slack. */}
							<div className="w-max min-w-full">
								<div
									className={`grid items-center ${HEADER_HEIGHT}`}
									style={{ gridTemplateColumns: HOUR_GRID_COLUMNS }}
								>
									<div className="sticky top-0 left-0 z-20 bg-[var(--paper-raised)]" />
									{HOURS.map((hour) => {
										const { number, meridiem } = hourTickParts(hour);
										return (
											<div
												key={`tick-${hour}`}
												className="sticky top-0 z-10 flex items-baseline justify-center gap-px bg-[var(--paper-raised)] leading-none"
											>
												<span className="font-semibold text-[10px] text-foreground">
													{number}
												</span>
												<span className="text-[7px] text-muted-foreground">
													{meridiem}
												</span>
											</div>
										);
									})}
								</div>

								{rows.map((row) => (
									<HourRow
										key={row.comName}
										row={row}
										windowLabel={activeWindow?.label ?? null}
									/>
								))}
							</div>
						</div>
					)}
				</section>
			</TooltipProvider>
		</div>
	);
}

/**
 * The date side of the toolbar: a native picker matched to the granularity,
 * flanked by steps to the nearest neighbouring window that actually holds
 * detections. The arrows disable at the ends of the station's history rather
 * than walking off into empty windows.
 */
function WindowPicker({
	period,
	anchor,
	stationRange,
	prevAnchor,
	nextAnchor,
	onPick,
}: {
	period: Exclude<TimelinePeriod, "all">;
	anchor: TimelineAnchor;
	stationRange: { first: string; last: string } | null;
	prevAnchor: TimelineAnchor | null;
	nextAnchor: TimelineAnchor | null;
	onPick: (anchor: TimelineAnchor) => void;
}) {
	const label = PICKER_LABELS[period];
	// Bounds in the picker's own notation, so the calendar greys out everything
	// the station could never have recorded.
	const min = stationRange
		? anchorForDay(period, stationRange.first)
		: undefined;
	const max = stationRange
		? anchorForDay(period, stationRange.last)
		: undefined;

	return (
		<div className="flex items-center gap-1">
			<StepButton
				direction="prev"
				label={`Previous ${label.toLowerCase()} with detections`}
				target={prevAnchor}
				onPick={onPick}
			/>
			<Input
				aria-label={label}
				className="!w-44"
				type={PICKER_TYPES[period]}
				value={anchor}
				min={min}
				max={max}
				step={period === "year" ? 1 : undefined}
				onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
					const next = event.target.value;
					// Half-typed values stream through on every keystroke; only commit
					// once one names a real window.
					if (isValidAnchor(period, next)) onPick(next);
				}}
			/>
			<StepButton
				direction="next"
				label={`Next ${label.toLowerCase()} with detections`}
				target={nextAnchor}
				onPick={onPick}
			/>
		</div>
	);
}

function StepButton({
	direction,
	label,
	target,
	onPick,
}: {
	direction: "prev" | "next";
	label: string;
	target: TimelineAnchor | null;
	onPick: (anchor: TimelineAnchor) => void;
}) {
	const Icon = direction === "prev" ? ChevronLeft : ChevronRight;

	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			disabled={target === null}
			onClick={() => target && onPick(target)}
			className="flex size-8 items-center justify-center rounded-md border border-[var(--line)] text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
		>
			<Icon className="size-4" />
		</button>
	);
}

/**
 * Marks a species the station had never recorded before the window opened, so
 * an arrival stands out from the residents it's stacked against. Matches the
 * day page's "First ever" badge, trimmed to fit a 2rem grid row.
 */
function NewBadge({ windowLabel }: { windowLabel: string }) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span
					className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] leading-none"
					style={{
						backgroundColor:
							"color-mix(in oklab, var(--sand) 22%, var(--paper-raised))",
						color: "var(--bark)",
					}}
				>
					<Sparkles className="size-2.5" />
					New
				</span>
			</TooltipTrigger>
			<TooltipContent>First recorded here in {windowLabel}</TooltipContent>
		</Tooltip>
	);
}

function HourRow({
	row,
	windowLabel,
}: {
	row: TimelineRow;
	/** Names the window in the "new species" tooltip; empty on all time. */
	windowLabel: string | null;
}) {
	const rowMax = Math.max(...row.hourCounts, 0);

	return (
		<div
			className={`grid items-center border-[var(--line)] border-t ${ROW_HEIGHT}`}
			style={{ gridTemplateColumns: HOUR_GRID_COLUMNS }}
		>
			<Link
				to="/species/$comName"
				params={{ comName: comNameToSlug(row.comName) }}
				className="group sticky left-0 z-10 flex items-center gap-2 bg-[var(--paper-raised)] pr-3 no-underline"
			>
				<div className="flex size-6 shrink-0 items-center justify-center">
					{row.imageUrl ? (
						<img
							src={row.imageUrl}
							alt={row.comName}
							className="max-h-full max-w-full object-contain"
							loading="lazy"
						/>
					) : (
						<Bird className="size-3.5 text-muted-foreground" />
					)}
				</div>
				<div className="min-w-0 truncate font-semibold text-sm group-hover:underline">
					{row.comName}
				</div>
				{row.isNew && windowLabel && <NewBadge windowLabel={windowLabel} />}
				{/* Rides in the sticky name cell so the total stays on screen no
				    matter how far the hour grid is scrolled. */}
				<span className="tabular-data ml-auto shrink-0 pl-4 font-semibold text-muted-foreground text-xs">
					{row.totalDetections.toLocaleString()}
				</span>
			</Link>

			{row.hourCounts.map((count, hour) => (
				<Tooltip key={hour}>
					<TooltipTrigger asChild>
						<div
							role="img"
							aria-label={`${row.comName} — ${hourLabel(hour)}: ${count} detections`}
							className="mx-0.5 my-1 h-4.5 rounded-[3px] border border-[var(--line)] transition-[outline] hover:z-10 hover:outline hover:outline-2 hover:outline-[var(--hover-line)] hover:outline-offset-1"
							style={{ backgroundColor: HEAT_COLORS[heatLevel(count, rowMax)] }}
						/>
					</TooltipTrigger>
					<TooltipContent>
						{row.comName} — {count}
					</TooltipContent>
				</Tooltip>
			))}
		</div>
	);
}
