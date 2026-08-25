import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
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
} from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";

import { EmptyState } from "~/components/empty-state.tsx";
import {
	PageHeaderCard,
	type PageHeaderStat,
} from "~/components/page-header-card.tsx";
import { SpeciesByHourCard } from "~/components/species-by-hour-card.tsx";
import { Input } from "~/components/ui/input.tsx";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group.tsx";
import { useShareCard } from "~/components/use-share-card.tsx";
import { pageTitle } from "~/lib/page-title.ts";
import { hourLabel } from "~/lib/time-ago.ts";
import { getTimelineData, type TimelineRow } from "~/lib/timeline.ts";
import {
	TIMELINE_PERIOD_LABELS,
	TIMELINE_PERIODS,
	type TimelinePeriod,
} from "~/lib/timeline-periods.ts";
import { formatTimelineShareCard } from "~/lib/timeline-share.ts";
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
	head: () => ({ meta: [{ title: pageTitle("Timeline") }] }),
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
	// Only ever read when the station has detections but this window has none --
	// a station with nothing at all is handled by the page-level empty below,
	// before this card renders. Naming the window makes sense here precisely
	// because the picker that chose it is on screen to explain it.
	const emptyMessage = activeWindow
		? `No detections recorded for ${activeWindow.label}.`
		: "No detections recorded in this window.";

	const show = (next: Partial<{ period: TimelinePeriod; date: string }>) =>
		navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });
	// The chart bodies need the kicker's bottom margin; the empty note brings its
	// own top margin, so keeping both would double the gap.

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

	// Everything the card says is already on this page, so the summary is built
	// from the loader's rows rather than fetched -- no round trip, and it can
	// never disagree with the figures above it.
	const share = useShareCard({
		// Named by what's showing, so switching period or stepping to another week
		// rebuilds the card instead of leaving the last one behind the button.
		subject: `${period}:${anchor}`,
		load: async () =>
			formatTimelineShareCard({
				period,
				windowLabel: activeWindow?.label ?? null,
				rows,
			}),
	});

	return (
		<div className="page-wrap space-y-4 py-4">
			<PageHeaderCard
				title="Timeline"
				description="When each species is active across the day, hour by hour."
				stats={stats}
				// Kept on screen for empty windows too -- the card says so in a line,
				// and a control that vanished as you stepped through quiet weeks would
				// shift the masthead under the cursor.
				action={hasAnyDetections ? share.trigger : undefined}
			>
				{share.summary}
			</PageHeaderCard>

			{/* Gated on the station rather than the window: an empty week still
			    needs the switcher to reach a window that has something in it. */}
			{hasAnyDetections && (
				<div className="flex flex-wrap items-center justify-between gap-3">
					{/* Five joined segments are wider than a phone, and a segmented
					    control cannot wrap without breaking its own shape -- so on a
					    narrow screen the row scrolls instead, the same way the site
					    nav above it does. The padding keeps focus rings off the clip
					    edge. */}
					<div className="-mx-1 max-w-full overflow-x-auto px-1 py-1">
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
					</div>

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

			{/* A station with nothing recorded has no window picker and no figures,
			    so the hour card would be an empty shell with one line in it. The
			    page-level treatment replaces it outright rather than nesting a card
			    inside a card. */}
			{!hasAnyDetections ? (
				<EmptyState icon={Bird} title="No detections recorded yet.">
					Once the station hears something, its daily rhythm will show up here.
				</EmptyState>
			) : (
				<SpeciesByHourCard
					rows={rows}
					newLabel={activeWindow?.label ?? null}
					emptyMessage={emptyMessage}
				/>
			)}
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
