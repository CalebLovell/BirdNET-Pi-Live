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
import { CHART_ANIMATION_MS } from "~/lib/chart-style.ts";
import type { HourActivity } from "~/lib/stats-data.ts";
import { hourLabel } from "~/lib/time-ago.ts";

/**
 * The detections-by-hour chart, shared by the stats page (every detection) and
 * the species page (one species). Only the data differs; the scoping, bucketing
 * and styling are deliberately identical in both places.
 */
export function DetectionsByHourCard({
	activity,
	className = "",
}: {
	activity: HourActivity[];
	className?: string;
}) {
	// Two of these can share a page in principle; a scoped id keeps the
	// gradients from colliding.
	const fillId = useId();

	// buildHourActivity always returns all 24 hours, so an empty chart is one
	// where every hour is zero rather than one with no points at all.
	const isEmpty = activity.every((point) => point.count === 0);

	if (isEmpty) {
		return (
			<section
				aria-label="Detections by hour"
				className={`feature-card flex flex-col rounded-md p-4 ${className}`}
			>
				<div className="island-kicker">Detections by hour</div>
				<p className="mt-4 text-muted-foreground text-sm">
					No detections recorded yet.
				</p>
			</section>
		);
	}

	return (
		<section
			aria-label="Detections by hour"
			className={`feature-card flex min-h-72 flex-col rounded-md p-4 ${className}`}
		>
			<div className="island-kicker">Detections by hour</div>

			<div className="mt-4 min-h-0 flex-1">
				<ResponsiveContainer width="100%" height="100%">
					<AreaChart data={activity}>
						<defs>
							<linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="var(--moss)" stopOpacity={0.2} />
								<stop offset="100%" stopColor="var(--moss)" stopOpacity={0} />
							</linearGradient>
						</defs>
						<CartesianGrid stroke="var(--line)" vertical={false} />
						<XAxis
							dataKey="hour"
							tickFormatter={hourLabel}
							stroke="var(--muted-foreground)"
							fontSize={12}
							tickLine={false}
							interval={3}
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
							content={(props) => (
								<ChartValueTooltip
									{...props}
									formatLabel={(hour) => hourLabel(Number(hour))}
								/>
							)}
							cursor={{ fill: "var(--sage)", fillOpacity: 0.2 }}
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
		</section>
	);
}
