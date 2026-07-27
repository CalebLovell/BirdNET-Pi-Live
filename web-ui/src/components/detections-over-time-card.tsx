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
import type { TrendPoint } from "~/lib/stats-data.ts";

/**
 * The detections-over-time chart, shared by the stats page (every detection)
 * and the species page (one species). Only the data differs; the scoping,
 * bucketing and styling are deliberately identical in both places.
 */
export function DetectionsOverTimeCard({
	trend,
	className = "",
}: {
	trend: TrendPoint[];
	className?: string;
}) {
	// Two of these can share a page in principle; a scoped id keeps the
	// gradients from colliding.
	const fillId = useId();

	return (
		<section
			aria-label="Detections over time"
			className={`feature-card flex min-h-72 flex-col rounded-md p-4 ${className}`}
		>
			<div className="island-kicker">Detections over time</div>

			{trend.length === 0 ? (
				<div className="mt-4 flex flex-1 items-center justify-center text-muted-foreground text-sm">
					No detections recorded yet.
				</div>
			) : (
				<div className="mt-4 min-h-0 flex-1">
					<ResponsiveContainer width="100%" height="100%">
						<AreaChart data={trend}>
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
								minTickGap={32}
							/>
							<YAxis
								stroke="var(--muted-foreground)"
								fontSize={12}
								tickLine={false}
								allowDecimals={false}
								width={32}
							/>
							<ChartTooltip {...chartTooltipStyle} />
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
			)}
		</section>
	);
}
