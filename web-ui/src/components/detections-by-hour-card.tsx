import type { ReactNode } from "react";
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

import { chartTooltipStyle } from "~/lib/chart-style.ts";
import { type HourActivity, hourLabel } from "~/lib/stats-data.ts";

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
							width={32}
						/>
						<ChartTooltip
							{...chartTooltipStyle}
							labelFormatter={(hour: ReactNode) => hourLabel(Number(hour))}
							cursor={{ fill: "var(--sage)", fillOpacity: 0.2 }}
						/>
						<Area
							dataKey="count"
							name="Detections"
							stroke="none"
							fill={`url(#${fillId})`}
						/>
						<Line
							type="monotone"
							dataKey="count"
							name="Detections"
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
