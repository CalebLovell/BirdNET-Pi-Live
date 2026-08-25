import { Link } from "@tanstack/react-router";
import { Bird, Sparkles } from "lucide-react";

import { EmptyNote } from "~/components/empty-state.tsx";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/components/ui/tooltip.tsx";
import { HEAT_COLORS, heatLevel } from "~/lib/heatmap.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";
import { hourLabel } from "~/lib/time-ago.ts";

/**
 * One species' day, as the grid draws it. Both callers carry more than this --
 * the timeline its eBird links, the day page its recordings -- so they narrow
 * to the fields the grid actually reads.
 */
export type SpeciesHourRow = {
	comName: string;
	imageUrl: string | null;
	/** 24 counts, midnight first. */
	hourCounts: number[];
	totalDetections: number;
	/** The station had never recorded this species before the window opened. */
	isNew: boolean;
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

// The hour columns share whatever the name column leaves over, so the cells
// stretch into rectangles on a wide card and fall back to their 26px floor
// (scrolling the card) once the viewport can't afford that.
const HOUR_GRID_COLUMNS = "16rem repeat(24, minmax(26px, 1fr))";

// Ink for the count sitting inside each cell, indexed the same way as
// HEAT_COLORS. The first four grounds are pale enough to take dark text; the
// busiest one is 70% moss, where only paper reads.
const HEAT_TEXT_COLORS = [
	"var(--muted-foreground)",
	"var(--foreground)",
	"var(--foreground)",
	"var(--foreground)",
	"var(--paper)",
] as const;

const HEADER_HEIGHT = "mb-2 h-4";
const ROW_HEIGHT = "h-8";

function hourTickParts(hour: number): { number: string; meridiem: string } {
	if (hour === 0) return { number: "12", meridiem: "a" };
	if (hour < 12) return { number: String(hour), meridiem: "a" };
	if (hour === 12) return { number: "12", meridiem: "p" };
	return { number: String(hour - 12), meridiem: "p" };
}

/**
 * The species x hour grid, shared by the timeline page (a window of days) and
 * the day page (one calendar day). Each row is scaled against its own busiest
 * hour, so a quiet species still shows the shape of when it was around rather
 * than flattening against the station's loudest bird.
 */
export function SpeciesByHourCard({
	rows,
	newLabel = null,
	emptyMessage,
	className = "",
}: {
	rows: SpeciesHourRow[];
	/** Names the window in the "New" tooltip. Null hides the badge entirely,
	 * which is what "all time" wants: everything is trivially first heard. */
	newLabel?: string | null;
	emptyMessage: string;
	className?: string;
}) {
	const isEmpty = rows.length === 0;

	return (
		<TooltipProvider>
			<section
				aria-label="Species by hour"
				className={`feature-card rounded-md p-4 ${className}`}
			>
				<div className={`island-kicker ${isEmpty ? "" : "mb-4"}`}>
					Species by hour
				</div>

				{isEmpty ? (
					<EmptyNote>{emptyMessage}</EmptyNote>
				) : (
					// p-1/-m-1 cancel out visually, but the padding gives the first
					// column's focus ring somewhere to draw: the row links sit flush
					// against the scrollport, so a 2px offset outline would be clipped
					// on its left edge without the slack.
					<div className="-m-1 overflow-x-auto p-1">
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
								<HourRow key={row.comName} row={row} newLabel={newLabel} />
							))}
						</div>
					</div>
				)}
			</section>
		</TooltipProvider>
	);
}

/**
 * Marks a species the station had never recorded before the window opened, so
 * an arrival stands out from the residents it's stacked against. Matches the
 * day page's "First ever" badge, trimmed to fit a 2rem grid row.
 */
function NewBadge({ newLabel }: { newLabel: string }) {
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
			<TooltipContent>First recorded here in {newLabel}</TooltipContent>
		</Tooltip>
	);
}

function HourRow({
	row,
	newLabel,
}: {
	row: SpeciesHourRow;
	newLabel: string | null;
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
				{row.isNew && newLabel && <NewBadge newLabel={newLabel} />}
				{/* Rides in the sticky name cell so the total stays on screen no
				    matter how far the hour grid is scrolled. */}
				<span className="tabular-data ml-auto shrink-0 pl-4 font-semibold text-muted-foreground text-xs">
					{row.totalDetections.toLocaleString()}
				</span>
			</Link>

			{/* Driven by the hour list rather than the counts, so each cell is keyed
			    by the hour it stands for instead of its position in the array. */}
			{HOURS.map((hour) => {
				const count = row.hourCounts[hour] ?? 0;
				const level = heatLevel(count, rowMax);
				return (
					<div
						key={`hour-${hour}`}
						role="img"
						aria-label={`${row.comName} — ${hourLabel(hour)}: ${count} detections`}
						className="tabular-data mx-0.5 my-1 flex h-6 items-center justify-center overflow-hidden rounded-[3px] border border-[var(--line)] text-[10px] leading-none"
						style={{
							backgroundColor: HEAT_COLORS[level],
							color: HEAT_TEXT_COLORS[level],
						}}
					>
						{/* A zero reads as an empty cell: printing the digit 24 times a
						    row would bury the counts that matter under noise. */}
						{count > 0 ? count.toLocaleString() : ""}
					</div>
				);
			})}
		</div>
	);
}
