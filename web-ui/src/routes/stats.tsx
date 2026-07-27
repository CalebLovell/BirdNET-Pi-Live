import { createFileRoute } from "@tanstack/react-router";
import {
	CalendarDays,
	ChartNoAxesColumnIncreasing,
	Clock3,
	Feather,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { DetectionsByHourCard } from "~/components/detections-by-hour-card.tsx";
import { DetectionsOverTimeCard } from "~/components/detections-over-time-card.tsx";
import { SpeciesList } from "~/components/species-list.tsx";
import { getStats } from "~/lib/stats.ts";
import { dayLabel, hourLabel } from "~/lib/stats-data.ts";

export const Route = createFileRoute("/stats")({
	loader: () => getStats(),
	component: Stats,
});

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
					label="Unique species"
					value={stats.uniqueSpecies}
					icon={Feather}
				/>
				<SummaryCard
					label="Busiest day"
					value={stats.busiestDay ? dayLabel(stats.busiestDay.date) : "—"}
					detail={
						stats.busiestDay
							? `${stats.busiestDay.count} detections`
							: undefined
					}
					icon={CalendarDays}
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
				<DetectionsByHourCard activity={stats.hourActivity} />
				<DetectionsOverTimeCard trend={stats.detectionTrend} />
				<SpeciesList
					title="Top species"
					species={stats.topSpeciesList}
					className="min-h-112"
				/>
				<SpeciesList
					title="Rarest species"
					species={stats.rarestSpeciesList}
					className="min-h-112"
				/>
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
