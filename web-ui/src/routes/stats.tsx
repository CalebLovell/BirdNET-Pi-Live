import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { CalendarRange, Infinity as InfinityIcon } from "lucide-react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { z } from "zod";

import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group.tsx";
import { getStatsForPeriod } from "~/lib/stats.ts";
import {
	STATS_PERIOD_LABELS,
	STATS_PERIODS,
	type StatsPeriod,
} from "~/lib/stats-periods.ts";

const DEFAULT_PERIOD: StatsPeriod = "year";

// .default() makes `period` optional on input (so <Link to="/stats"> doesn't
// need to pass search) while guaranteeing a concrete value on output (so
// Route.useSearch().period is never undefined). Zod v4: use .catch(), not
// the @tanstack/zod-adapter fallback() helper (that's a Zod v3 workaround).
const statsSearchSchema = z.object({
	period: z.enum(STATS_PERIODS).default(DEFAULT_PERIOD).catch(DEFAULT_PERIOD),
});

export const Route = createFileRoute("/stats")({
	validateSearch: statsSearchSchema,
	search: {
		middlewares: [stripSearchParams({ period: DEFAULT_PERIOD })],
	},
	loaderDeps: ({ search }) => ({ period: search.period }),
	loader: ({ deps }) => getStatsForPeriod({ data: deps.period }),
	component: Stats,
});

const PERIOD_ICONS: Record<
	StatsPeriod,
	React.ComponentType<{ className?: string }>
> = {
	year: CalendarRange,
	all: InfinityIcon,
};

function Stats() {
	const { period } = Route.useSearch();
	const navigate = Route.useNavigate();
	const stats = Route.useLoaderData();

	return (
		<div className="page-wrap py-6">
			<ToggleGroup
				type="single"
				variant="outline"
				value={period}
				onValueChange={(value) => {
					if (!value) return;
					navigate({
						search: (prev) => ({ ...prev, period: value as StatsPeriod }),
						replace: true,
					});
				}}
				className=""
			>
				{STATS_PERIODS.map((p) => {
					const Icon = PERIOD_ICONS[p];
					return (
						<ToggleGroupItem key={p} value={p}>
							<Icon className="size-4" />
							{STATS_PERIOD_LABELS[p]}
						</ToggleGroupItem>
					);
				})}
			</ToggleGroup>

			<div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
				<StatCard label="Total detections" value={stats.totalDetections} />
				<StatCard label="Species detected" value={stats.uniqueSpecies} />
				<StatCard
					label="Top species"
					value={stats.topSpecies?.comName ?? "—"}
					sub={
						stats.topSpecies
							? `${stats.topSpecies.count} detections`
							: undefined
					}
				/>
				<StatCard
					label="Busiest"
					value={stats.busiest?.label ?? "—"}
					sub={stats.busiest ? `${stats.busiest.count} detections` : undefined}
				/>
			</div>

			<h2 className="display-title mt-10 text-xl font-semibold">
				Detections over time
			</h2>
			<div className="feature-card mt-4 rounded-md p-4">
				<ResponsiveContainer width="100%" height={280}>
					<AreaChart data={stats.trend}>
						<defs>
							<linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="var(--moss)" stopOpacity={0.35} />
								<stop offset="100%" stopColor="var(--moss)" stopOpacity={0} />
							</linearGradient>
						</defs>
						<CartesianGrid stroke="var(--line)" vertical={false} />
						<XAxis
							dataKey="label"
							stroke="var(--muted-foreground)"
							fontSize={12}
							tickLine={false}
						/>
						<YAxis
							stroke="var(--muted-foreground)"
							fontSize={12}
							tickLine={false}
							allowDecimals={false}
							width={32}
						/>
						<Tooltip
							contentStyle={{
								background: "var(--paper-raised)",
								border: "1px solid var(--line)",
								borderRadius: "var(--radius-sm)",
								color: "var(--ink)",
								fontSize: 13,
							}}
							labelStyle={{ color: "var(--ink)", fontWeight: 600 }}
						/>
						<Area
							type="monotone"
							dataKey="count"
							name="Detections"
							stroke="var(--moss)"
							strokeWidth={2}
							fill="url(#trendFill)"
						/>
					</AreaChart>
				</ResponsiveContainer>
			</div>

			<div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
				<div>
					<h2 className="display-title text-xl font-semibold">Top species</h2>
					<div className="feature-card mt-4 rounded-md p-4">
						<ResponsiveContainer
							width="100%"
							height={Math.max(240, stats.topSpeciesList.length * 32)}
						>
							<BarChart
								data={stats.topSpeciesList}
								layout="vertical"
								margin={{ left: 8 }}
							>
								<CartesianGrid stroke="var(--line)" horizontal={false} />
								<XAxis
									type="number"
									stroke="var(--muted-foreground)"
									fontSize={12}
									tickLine={false}
									allowDecimals={false}
								/>
								<YAxis
									type="category"
									dataKey="comName"
									stroke="var(--muted-foreground)"
									fontSize={12}
									tickLine={false}
									width={140}
								/>
								<Tooltip
									contentStyle={{
										background: "var(--paper-raised)",
										border: "1px solid var(--line)",
										borderRadius: "var(--radius-sm)",
										color: "var(--ink)",
										fontSize: 13,
									}}
									labelStyle={{ color: "var(--ink)", fontWeight: 600 }}
									cursor={{ fill: "var(--sage)", fillOpacity: 0.2 }}
								/>
								<Bar
									dataKey="count"
									name="Detections"
									fill="var(--sand)"
									radius={[0, 4, 4, 0]}
								/>
							</BarChart>
						</ResponsiveContainer>
					</div>
				</div>

				<div>
					<h2 className="display-title text-xl font-semibold">
						Activity by hour of day
					</h2>
					<div className="feature-card mt-4 rounded-md p-4">
						<ResponsiveContainer width="100%" height={280}>
							<BarChart data={stats.hourActivity}>
								<CartesianGrid stroke="var(--line)" vertical={false} />
								<XAxis
									dataKey="hour"
									tickFormatter={(hour: number) =>
										hour === 0
											? "12a"
											: hour < 12
												? `${hour}a`
												: hour === 12
													? "12p"
													: `${hour - 12}p`
									}
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
								<Tooltip
									contentStyle={{
										background: "var(--paper-raised)",
										border: "1px solid var(--line)",
										borderRadius: "var(--radius-sm)",
										color: "var(--ink)",
										fontSize: 13,
									}}
									labelStyle={{ color: "var(--ink)", fontWeight: 600 }}
									labelFormatter={(hour: React.ReactNode) => `${hour}:00`}
									cursor={{ fill: "var(--sage)", fillOpacity: 0.2 }}
								/>
								<Bar
									dataKey="count"
									name="Detections"
									fill="var(--clay)"
									radius={[3, 3, 0, 0]}
								/>
							</BarChart>
						</ResponsiveContainer>
					</div>
				</div>
			</div>
		</div>
	);
}

function StatCard({
	label,
	value,
	sub,
}: {
	label: string;
	value: string | number;
	sub?: string;
}) {
	return (
		<div className="feature-card rounded-md p-4">
			<div
				className={
					typeof value === "number"
						? "tabular-data truncate text-2xl font-semibold"
						: "truncate text-xl font-semibold"
				}
			>
				{value}
			</div>
			<div className="mt-1 text-sm text-muted-foreground">{label}</div>
			{sub && (
				<div className="tabular-data mt-0.5 text-xs text-muted-foreground">
					{sub}
				</div>
			)}
		</div>
	);
}
