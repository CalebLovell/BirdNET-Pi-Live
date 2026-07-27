import { createFileRoute } from "@tanstack/react-router";
import {
	CalendarDays,
	ChartNoAxesColumnIncreasing,
	Clock3,
	Feather,
} from "lucide-react";

import { DetectionsByHourCard } from "~/components/detections-by-hour-card.tsx";
import { DetectionsOverTimeCard } from "~/components/detections-over-time-card.tsx";
import {
	PageHeaderCard,
	type PageHeaderStat,
} from "~/components/page-header-card.tsx";
import { SpeciesList } from "~/components/species-list.tsx";
import { getStats } from "~/lib/stats.ts";
import { dayLabel, hourLabel } from "~/lib/stats-data.ts";

export const Route = createFileRoute("/stats")({
	loader: () => getStats(),
	component: Stats,
});

function Stats() {
	const stats = Route.useLoaderData();

	const headerStats: PageHeaderStat[] = [
		{
			label: "Total detections",
			value: stats.totalDetections,
			icon: ChartNoAxesColumnIncreasing,
		},
		{ label: "Unique species", value: stats.uniqueSpecies, icon: Feather },
		{
			label: "Busiest day",
			value: stats.busiestDay ? dayLabel(stats.busiestDay.date) : "—",
			detail: stats.busiestDay
				? `${stats.busiestDay.count} detections`
				: undefined,
			icon: CalendarDays,
		},
		{
			label: "Busiest hour",
			value: stats.busiestHour ? hourLabel(stats.busiestHour.hour) : "—",
			detail: stats.busiestHour
				? `${stats.busiestHour.count} detections`
				: undefined,
			icon: Clock3,
		},
	];

	return (
		<div className="page-wrap py-4">
			<PageHeaderCard
				title="Statistics"
				description="How detections break down across species, days, and hours."
				stats={headerStats}
			/>

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
