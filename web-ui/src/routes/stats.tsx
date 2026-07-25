import { createFileRoute, Link } from "@tanstack/react-router";
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

import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/components/ui/tooltip.tsx";
import { sciNameToSlug } from "~/lib/species-slug.ts";
import { getStats } from "~/lib/stats.ts";
import {
	type HourActivity,
	hourLabel,
	rankingBarPercent,
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
		<TooltipProvider>
			<div className="page-wrap py-4">
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					<SummaryCard
						label="Total detections"
						value={stats.totalDetections}
						sub="All recorded visits"
						icon={ChartNoAxesColumnIncreasing}
					/>
					<SummaryCard
						label="Species detected"
						value={stats.uniqueSpecies}
						sub="Unique species"
						icon={Feather}
					/>
					<SummaryCard
						label="Top species"
						value={stats.topSpecies?.comName ?? "—"}
						sub={
							stats.topSpecies
								? `${stats.topSpecies.count} detections`
								: "No detections yet"
						}
						icon={Bird}
						artwork={
							stats.topSpecies?.imageUrl ? (
								<img
									src={stats.topSpecies.imageUrl}
									alt={stats.topSpecies.comName}
									className="size-10 object-contain"
								/>
							) : undefined
						}
					/>
					<SummaryCard
						label="Busiest hour"
						value={stats.busiestHour ? hourLabel(stats.busiestHour.hour) : "—"}
						sub={
							stats.busiestHour
								? `${stats.busiestHour.count} detections`
								: "No detections yet"
						}
						icon={Clock3}
					/>
				</div>

				<div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
					<TopSpeciesCard species={stats.topSpeciesList} />
					<HourlyActivityCard activity={stats.hourActivity} />
				</div>
			</div>
		</TooltipProvider>
	);
}

function SummaryCard({
	label,
	value,
	sub,
	icon: Icon,
	artwork,
}: {
	label: string;
	value: string | number;
	sub: string;
	icon: ComponentType<{ className?: string }>;
	artwork?: ReactNode;
}) {
	return (
		<div className="feature-card flex flex-col gap-4 overflow-hidden rounded-md p-4">
			<div className="flex items-start justify-between gap-4">
				<div className="island-kicker">{label}</div>
				{artwork ?? (
					<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--sage)_30%,var(--paper-raised))]">
						<Icon className="size-5 text-[var(--moss)]" />
					</div>
				)}
			</div>
			<div className="flex flex-col gap-4">
				<div
					className={
						typeof value === "number"
							? "tabular-data truncate font-semibold text-3xl leading-none"
							: "display-title line-clamp-2 font-semibold text-xl leading-tight"
					}
				>
					{value}
				</div>
				<div className="tabular-data text-muted-foreground text-xs">{sub}</div>
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
				<div className="mt-4">
					{species.map((item) => (
						<TopSpeciesRow
							key={item.sciName}
							species={item}
							maximum={maximum}
						/>
					))}
				</div>
			)}
		</section>
	);
}

function TopSpeciesRow({
	species,
	maximum,
}: {
	species: SpeciesCount;
	maximum: number;
}) {
	return (
		<div className="grid h-10 grid-cols-[minmax(0,12rem)_minmax(4rem,1fr)_3rem] items-center gap-4 border-[var(--line)] border-t first:border-t-0">
			<Link
				to="/species/$sciName"
				params={{ sciName: sciNameToSlug(species.sciName) }}
				className="flex min-w-0 items-center gap-4 rounded-sm no-underline focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2"
			>
				<div className="flex size-8 shrink-0 items-center justify-center">
					{species.imageUrl ? (
						<img
							src={species.imageUrl}
							alt={species.comName}
							className="max-h-full max-w-full object-contain"
							loading="lazy"
						/>
					) : (
						<Bird className="size-4 text-muted-foreground" />
					)}
				</div>
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="truncate font-semibold text-sm">
							{species.comName}
						</span>
					</TooltipTrigger>
					<TooltipContent>{species.comName}</TooltipContent>
				</Tooltip>
			</Link>

			<Tooltip>
				<TooltipTrigger asChild>
					<div
						className="h-3 overflow-hidden rounded-r-full"
						style={{
							backgroundColor:
								"color-mix(in oklab, var(--bark) 18%, var(--paper-raised))",
						}}
					>
						<div
							className="h-full rounded-r-full bg-[var(--moss)]"
							style={{
								width: `${rankingBarPercent(species.count, maximum)}%`,
							}}
						/>
					</div>
				</TooltipTrigger>
				<TooltipContent>
					{species.comName} — {species.count} detections
				</TooltipContent>
			</Tooltip>

			<span className="tabular-data text-right text-muted-foreground text-xs">
				{species.count}
			</span>
		</div>
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
