import { useId } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	Tooltip as ChartTooltip,
	Line,
	ResponsiveContainer,
	XAxis,
	YAxis,
} from "recharts";

import { ChartValueTooltip } from "~/components/chart-tooltip.tsx";
import { YearSelector } from "~/components/year-selector.tsx";
import { CHART_ANIMATION_MS } from "~/lib/chart-style.ts";
import type { TrendPoint } from "~/lib/stats-data.ts";

/**
 * The detections-by-month chart, shared by the stats page (every detection)
 * and the species page (one species). Only the data differs; the scoping,
 * bucketing and styling are deliberately identical in both places.
 */
export function DetectionsByMonthCard({
	trend,
	year,
	years,
	onYearChange,
	className = "",
}: {
	/** The twelve months of `year`, zero-filled. */
	trend: TrendPoint[];
	year: number;
	years: number[];
	onYearChange: (year: number) => void;
	className?: string;
}) {
	// Two of these can share a page in principle; a scoped id keeps the
	// gradients from colliding.
	const fillId = useId();
	const isEmpty = trend.every((point) => point.count === 0);

	return (
		<section
			aria-label="Detections by month"
			// The min-height reserves room for the chart; with only a line of text
			// in the card it would just be empty space.
			className={`feature-card flex flex-col rounded-md p-4 ${isEmpty ? "" : "min-h-72"} ${className}`}
		>
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div className="island-kicker">Detections by month</div>
				<YearSelector year={year} years={years} onChange={onYearChange} />
			</div>

			{isEmpty ? (
				<p className="mt-4 text-muted-foreground text-sm">
					No detections recorded in {year}.
				</p>
			) : (
				<div className="mt-4 min-h-0 flex-1">
					<ResponsiveContainer width="100%" height="100%">
						<AreaChart
							data={trend}
							// Every month gets a tick, and the last one is centred on the
							// right edge -- without the extra room "Dec" loses its tail.
							margin={{ top: 5, right: 16, bottom: 5, left: 5 }}
						>
							<defs>
								<linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stopColor="var(--moss)" stopOpacity={0.2} />
									<stop offset="100%" stopColor="var(--moss)" stopOpacity={0} />
								</linearGradient>
							</defs>
							<CartesianGrid stroke="var(--line)" vertical={false} />
							<XAxis
								dataKey="label"
								stroke="var(--muted-foreground)"
								fontSize={12}
								tickLine={false}
								minTickGap={0}
								interval={0}
							/>
							<YAxis
								stroke="var(--muted-foreground)"
								fontSize={12}
								tickLine={false}
								allowDecimals={false}
								// Auto rather than a fixed width: a busy station's five-digit
								// counts were being clipped to their trailing digits.
								width="auto"
							/>
							<ChartTooltip
								content={(props) => <ChartValueTooltip {...props} />}
							/>
							{/* The wash under the line, not a series of its own: it plots the
							    same counts, so left in the tooltip it listed every value twice. */}
							<Area
								dataKey="count"
								tooltipType="none"
								animationDuration={CHART_ANIMATION_MS}
								stroke="none"
								fill={`url(#${fillId})`}
							/>
							<Line
								type="monotone"
								dataKey="count"
								animationDuration={CHART_ANIMATION_MS}
								stroke="var(--moss)"
								strokeWidth={2}
								dot={false}
								activeDot={{ r: 3, fill: "var(--moss)" }}
							/>
						</AreaChart>
					</ResponsiveContainer>
				</div>
			)}
		</section>
	);
}
