import { Link } from "@tanstack/react-router";
import { Bird, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

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

// The left panel is three tracks -- name, bar, count. The name keeps a fixed
// column (wide enough for a bird's name, truncating the longest) so the bars
// all start at the same x; the bar then takes every remaining pixel, so it's
// the bar -- not a stretched-out name column -- that soaks up the card's spare
// width. The count sits in its own narrow column so the numbers stay in a line.
const LABEL_GRID_COLUMNS = "15rem minmax(0, 1fr) auto";

// The hour columns are a fixed 1.75rem wide so each cell stays square (its
// 1.5rem tile plus the 0.125rem margin on either side) no matter how wide the
// card gets -- the grid never stretches the tiles into rectangles, and it
// scrolls once the viewport can't afford the full 24 columns.
const HOUR_GRID_COLUMNS = "repeat(24, 1.75rem)";

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
 * the day page (one calendar day). A fixed left panel ranks the species by
 * total detections as a bar chart; the heatmap to its right scales each row
 * against its own busiest hour, so a quiet species still shows the shape of
 * when it was around rather than flattening against the station's loudest bird.
 * The heatmap is hidden on mobile, where the bars alone carry the ranking.
 */
export function SpeciesByHourCard({
	rows,
	newLabel = null,
	emptyMessage,
	action,
	className = "",
}: {
	rows: SpeciesHourRow[];
	/** Names the window in the "New" tooltip. Null hides the badge entirely,
	 * which is what "all time" wants: everything is trivially first heard. */
	newLabel?: string | null;
	emptyMessage: string;
	/** A control set against the card title, top-right -- the view switcher on
	 * the timeline page. Omitted by callers that show the card on its own. */
	action?: ReactNode;
	className?: string;
}) {
	const isEmpty = rows.length === 0;
	// The busiest bird sets the bar scale for the whole panel, so a bar's length
	// reads against the loudest species rather than against itself.
	const maxTotal = Math.max(...rows.map((row) => row.totalDetections), 0);
	// The count column is fixed to the widest number's character count, so a
	// two-digit row doesn't push its bar shorter than a one-digit row's -- every
	// bar ends at the same x, with the digits right-aligned into that column.
	const countWidthCh = maxTotal.toLocaleString().length;

	return (
		<TooltipProvider>
			<section
				aria-label="Species by hour"
				className={`feature-card rounded-md p-4 ${className}`}
			>
				<div
					className={`flex items-center justify-between gap-3 ${isEmpty && !action ? "" : "mb-4"}`}
				>
					<div className="island-kicker">Species by hour</div>
					{action}
				</div>

				{isEmpty ? (
					<EmptyNote>{emptyMessage}</EmptyNote>
				) : (
					<div className="flex gap-4">
						{/* LEFT: bird, name and a detections bar. Grows to fill the card's
						    spare width, and is the only panel on mobile. The min width
						    keeps the names legible on a tight card -- past that floor the
						    heatmap gives way and scrolls rather than the names collapsing.
						    p-1/-m-1 give the row links' focus ring room against the edge. */}
						<div className="-m-1 min-w-0 flex-1 p-1">
							<div
								// gap-6 matches the bar rows, so the "Detections" caption
								// sits over the bar column's left edge rather than shy of it.
								className={`grid items-end gap-6 ${HEADER_HEIGHT}`}
								style={{ gridTemplateColumns: LABEL_GRID_COLUMNS }}
							>
								<span />
								<span className="text-[10px] text-muted-foreground">
									Detections
								</span>
								<span />
							</div>

							{rows.map((row) => (
								<BarRow
									key={row.comName}
									row={row}
									maxTotal={maxTotal}
									countWidthCh={countWidthCh}
									newLabel={newLabel}
								/>
							))}
						</div>

						{/* RIGHT: the hour heatmap, taking half the card. Its columns keep
						    their fixed square size, so when the 24 of them outgrow the half
						    it scrolls rather than stretching; on mobile it drops away. */}
						<div className="-m-1 hidden overflow-x-auto p-1 md:block md:min-w-0 md:flex-1">
							<div className="w-max">
								<div
									className={`grid items-center ${HEADER_HEIGHT}`}
									style={{ gridTemplateColumns: HOUR_GRID_COLUMNS }}
								>
									{HOURS.map((hour) => {
										const { number, meridiem } = hourTickParts(hour);
										return (
											<div
												key={`tick-${hour}`}
												className="flex items-baseline justify-center gap-px leading-none"
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
									<HeatRow key={row.comName} row={row} />
								))}
							</div>
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

/**
 * The left panel's row: bird, name and a bar whose length is the row's share of
 * the busiest species' total. The count rides at the bar's end so the axis
 * doesn't need its own ticks.
 */
function BarRow({
	row,
	maxTotal,
	countWidthCh,
	newLabel,
}: {
	row: SpeciesHourRow;
	maxTotal: number;
	countWidthCh: number;
	newLabel: string | null;
}) {
	// A non-zero count always shows a sliver, so a quiet bird doesn't vanish into
	// the track next to a loud one.
	const fillPercent =
		maxTotal > 0 && row.totalDetections > 0
			? Math.max((row.totalDetections / maxTotal) * 100, 2)
			: 0;

	return (
		<Link
			to="/species/$comName"
			params={{ comName: comNameToSlug(row.comName) }}
			className={`group grid items-center gap-6 border-[var(--line)] border-t no-underline ${ROW_HEIGHT}`}
			style={{ gridTemplateColumns: LABEL_GRID_COLUMNS }}
		>
			{/* Left-aligned against the panel edge, so the names read as a column
			    down the left rather than ragged against the bars. */}
			<div className="flex min-w-0 items-center gap-2">
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
			</div>

			<div
				className="h-2.5 w-full overflow-hidden rounded-full"
				style={{
					backgroundColor:
						"color-mix(in oklab, var(--moss) 12%, var(--paper-raised))",
				}}
			>
				<div
					className="h-full rounded-full"
					style={{
						width: `${fillPercent}%`,
						backgroundColor: "var(--moss)",
					}}
				/>
			</div>

			{/* Sits at the section's end, right-aligned into a column fixed to the
			    widest count -- so the bar always ends at the same x -- with the grid
			    gap to the bar matching the space the name keeps on the other side. */}
			<span
				className="tabular-data shrink-0 text-right font-semibold text-muted-foreground text-xs"
				style={{ width: `${countWidthCh}ch` }}
			>
				{row.totalDetections.toLocaleString()}
			</span>
		</Link>
	);
}

/**
 * The heatmap panel's row: 24 cells, each scaled against this row's own busiest
 * hour so the shape of the day reads regardless of the bird's overall volume.
 */
function HeatRow({ row }: { row: SpeciesHourRow }) {
	const rowMax = Math.max(...row.hourCounts, 0);

	return (
		<div
			className={`grid items-center border-[var(--line)] border-t ${ROW_HEIGHT}`}
			style={{ gridTemplateColumns: HOUR_GRID_COLUMNS }}
		>
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
