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
	Clock,
	Clock3,
	Feather,
	Infinity as InfinityIcon,
} from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";

import {
	PageHeaderCard,
	type PageHeaderStat,
} from "~/components/page-header-card.tsx";
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

const DEFAULT_PERIOD: TimelinePeriod = "week";

const timelineSearchSchema = z.object({
	period: z
		.enum(TIMELINE_PERIODS)
		.default(DEFAULT_PERIOD)
		.catch(DEFAULT_PERIOD),
});

export const Route = createFileRoute("/timeline")({
	validateSearch: timelineSearchSchema,
	search: {
		middlewares: [stripSearchParams({ period: DEFAULT_PERIOD })],
	},
	loaderDeps: ({ search }) => ({ period: search.period }),
	loader: ({ deps }) => getTimelineData({ data: deps.period }),
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

const HOUR_GRID_COLUMNS = "16rem repeat(24, 26px)";

// Shared across both cards so their headers and rows land at identical
// pixel heights even though they're independent grids/flexboxes.
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

// Lowercased tails of TIMELINE_PERIOD_LABELS, so the empty state names the same
// window the toggle does instead of the vague "this period".
const EMPTY_PERIOD_PHRASES: Record<TimelinePeriod, string> = {
	day: "No detections recorded in the last 24 hours.",
	week: "No detections recorded in the last 7 days.",
	month: "No detections recorded in the last 30 days.",
	year: "No detections recorded in the last year.",
	all: "No detections recorded yet.",
};

function EmptyNote({ children }: { children: React.ReactNode }) {
	return <p className="mt-4 text-muted-foreground text-sm">{children}</p>;
}

function Timeline() {
	const { rows, hasAnyDetections } = Route.useLoaderData();
	const { period } = Route.useSearch();
	const navigate = Route.useNavigate();
	const maxTotal = Math.max(...rows.map((row) => row.totalDetections), 1);
	const isEmpty = rows.length === 0;
	// Naming a period only makes sense while the switcher is on screen to
	// explain it; a station with nothing recorded just says so.
	const emptyMessage = hasAnyDetections
		? EMPTY_PERIOD_PHRASES[period]
		: "No detections recorded yet.";
	// The chart bodies need the kicker's bottom margin; the empty note brings its
	// own top margin, so keeping both would double the gap.
	const kickerClass = isEmpty ? "island-kicker" : "island-kicker mb-4";

	// Every figure is derived from the already period-scoped rows, so the
	// header moves with the period toggle without a second round trip.
	const stats = useMemo<PageHeaderStat[]>(() => {
		// With nothing detected, every figure is a 0 or an em dash -- scaffolding
		// that reads as broken rather than empty. PageHeaderCard drops the row for
		// an empty array, leaving the title and description to carry the masthead.
		if (rows.length === 0) return [];

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

			{/* Gated on the station rather than the period: an empty week still
			    needs the switcher to reach a period that has something in it. */}
			{hasAnyDetections && (
				<div className="flex justify-end">
					<ToggleGroup
						type="single"
						variant="outline"
						value={period}
						onValueChange={(value) => {
							if (!value) return;
							navigate({
								search: (prev) => ({
									...prev,
									period: value as TimelinePeriod,
								}),
								replace: true,
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
			)}

			<TooltipProvider>
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start">
					<section
						aria-label="Detections by hour"
						className={`feature-card min-w-0 rounded-md p-4 ${isEmpty ? "flex-1" : ""}`}
					>
						<div className={kickerClass}>Detections by hour</div>
						{isEmpty ? (
							<EmptyNote>{emptyMessage}</EmptyNote>
						) : (
							<div className="overflow-x-auto">
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
										<HourRow key={row.comName} row={row} />
									))}
								</div>
							</div>
						)}
					</section>

					<section
						aria-label="Total detections"
						className="feature-card min-w-0 flex-1 rounded-md p-4"
					>
						<div className={kickerClass}>Total detections</div>
						{isEmpty ? (
							<EmptyNote>{emptyMessage}</EmptyNote>
						) : (
							<>
								<div className={HEADER_HEIGHT} />
								{rows.map((row) => (
									<BarRow key={row.comName} row={row} maxTotal={maxTotal} />
								))}
							</>
						)}
					</section>
				</div>
			</TooltipProvider>
		</div>
	);
}

function HourRow({ row }: { row: TimelineRow }) {
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
			</Link>

			{row.hourCounts.map((count, hour) => (
				<Tooltip key={hour}>
					<TooltipTrigger asChild>
						<div
							role="img"
							aria-label={`${row.comName} — ${hourLabel(hour)}: ${count} detections`}
							className="m-1 size-4.5 rounded-[3px] border border-[var(--line)] transition-[outline] hover:z-10 hover:outline hover:outline-2 hover:outline-[var(--hover-line)] hover:outline-offset-1"
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

function BarRow({ row, maxTotal }: { row: TimelineRow; maxTotal: number }) {
	const barPercent = Math.max(
		2,
		Math.round((row.totalDetections / maxTotal) * 100),
	);

	return (
		<div
			className={`flex items-center gap-2 border-[var(--line)] border-t ${ROW_HEIGHT}`}
		>
			<div className="w-28 shrink-0 truncate font-medium text-xs lg:hidden">
				{row.comName}
			</div>
			<Tooltip>
				<TooltipTrigger asChild>
					<div
						className="h-2.5 flex-1 overflow-hidden rounded-r-full rounded-l-none"
						style={{
							backgroundColor:
								"color-mix(in oklab, var(--bark) 18%, var(--paper-raised))",
						}}
					>
						<div
							className="h-full rounded-r-full rounded-l-none bg-[var(--bark)]"
							style={{ width: `${barPercent}%` }}
						/>
					</div>
				</TooltipTrigger>
				<TooltipContent>
					{row.comName} — {row.totalDetections}
				</TooltipContent>
			</Tooltip>
			<span className="tabular-data w-8 shrink-0 text-right text-[10px] text-muted-foreground">
				{row.totalDetections}
			</span>
		</div>
	);
}
