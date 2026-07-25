import { createFileRoute } from "@tanstack/react-router";
import {
	Bird,
	ChartNoAxesColumnIncreasing,
	Clock3,
	Feather,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
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

import { SpeciesRankRow } from "~/components/species-rank-row.tsx";
import { sciNameToSlug } from "~/lib/species-slug.ts";
import { getStats } from "~/lib/stats.ts";
import {
	type HourActivity,
	hourLabel,
	type SpeciesCount,
} from "~/lib/stats-data.ts";

export const Route = createFileRoute("/stats")({
	loader: () => getStats(),
	component: Stats,
});

const chartTooltipStyle = {
	contentStyle: {
		background: "var(--paper-raised)",
		border: "1px solid var(--line)",
		borderRadius: "var(--radius-sm)",
		color: "var(--ink)",
		fontSize: 13,
	},
	labelStyle: { color: "var(--ink)", fontWeight: 600 },
};

function Stats() {
	const stats = Route.useLoaderData();

	return (
		<div className="page-wrap py-4">
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<SummaryCard
					label="Total detections"
					value={stats.totalDetections}
					icon={ChartNoAxesColumnIncreasing}
				/>
				<SummaryCard
					label="Species detected"
					value={stats.uniqueSpecies}
					icon={Feather}
				/>
				<SummaryCard
					label="Top species"
					value={stats.topSpecies?.comName ?? "—"}
					detail={
						stats.topSpecies
							? `${stats.topSpecies.count} detections`
							: undefined
					}
					icon={Bird}
					artwork={
						stats.topSpecies?.imageUrl ? (
							<img
								src={stats.topSpecies.imageUrl}
								alt={stats.topSpecies.comName}
								className="size-8 object-contain"
							/>
						) : undefined
					}
				/>
				<SummaryCard
					label="Busiest hour"
					value={stats.busiestHour ? hourLabel(stats.busiestHour.hour) : "—"}
					detail={
						stats.busiestHour
							? `${stats.busiestHour.count} detections`
							: undefined
					}
					icon={Clock3}
				/>
			</div>

			<div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
				<TopSpeciesCard species={stats.topSpeciesList} />
				<HourlyActivityCard activity={stats.hourActivity} />
			</div>
		</div>
	);
}

function SummaryCard({
	label,
	value,
	detail,
	icon: Icon,
	artwork,
}: {
	label: string;
	value: string | number;
	detail?: string;
	icon: ComponentType<{ className?: string }>;
	artwork?: ReactNode;
}) {
	return (
		<div className="feature-card flex items-center gap-4 overflow-hidden rounded-md p-4">
			{artwork ?? (
				<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--sage)_30%,var(--paper-raised))]">
					<Icon aria-hidden="true" className="size-4 text-[var(--moss)]" />
				</div>
			)}
			<div className="min-w-0 flex-1">
				<div className="island-kicker">{label}</div>
				<div className="mt-2 flex min-w-0 items-baseline gap-2">
					<div
						className={
							typeof value === "number"
								? "tabular-data truncate font-semibold text-3xl leading-none"
								: "display-title truncate font-semibold text-xl leading-tight"
						}
					>
						{value}
					</div>
					{detail ? (
						<div className="tabular-data hidden shrink-0 text-[10px] text-muted-foreground sm:block">
							{detail}
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}

function TopSpeciesCard({ species }: { species: SpeciesCount[] }) {
	const maximum = Math.max(...species.map((item) => item.count), 0);

	return (
		<section
			aria-label="Top species"
			className="feature-card flex min-h-112 flex-col rounded-md p-4"
		>
			<div className="island-kicker">Top species</div>

			{species.length === 0 ? (
				<div className="mt-4 flex flex-1 items-center justify-center text-muted-foreground text-sm">
					No detections recorded yet.
				</div>
			) : (
				<ol className="mt-4 space-y-1">
					{species.map((item) => (
						<SpeciesRankRow
							key={item.sciName}
							comName={item.comName}
							sciName={item.sciName}
							speciesSlug={sciNameToSlug(item.sciName)}
							imageUrl={item.imageUrl}
							count={item.count}
							maximum={maximum}
						/>
					))}
				</ol>
			)}
		</section>
	);
}

function HourlyActivityCard({ activity }: { activity: HourActivity[] }) {
	return (
		<section
			aria-label="Activity by hour of day"
			className="feature-card flex min-h-112 flex-col rounded-md p-4"
		>
			<div className="island-kicker">Activity by hour of day</div>

			<div className="mt-4 min-h-0 flex-1">
				<ResponsiveContainer width="100%" height="100%">
					<AreaChart data={activity}>
						<defs>
							<linearGradient
								id="statsHourDensityFill"
								x1="0"
								y1="0"
								x2="0"
								y2="1"
							>
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
							fill="url(#statsHourDensityFill)"
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
