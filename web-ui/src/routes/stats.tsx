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

	const isEmpty = stats.totalDetections === 0;

	// Nothing recorded means two zeros and two em dashes -- scaffolding that
	// reads as broken rather than empty, so the row comes off entirely.
	const headerStats: PageHeaderStat[] = isEmpty
		? []
		: [
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
				{/* No min-height: the two lists sit in the same grid row, so they
				    already stretch to match each other. Reserving height instead only
				    padded them with dead space until the lists were long enough. */}
				<SpeciesList title="Top species" species={stats.topSpeciesList} />
				<SpeciesList title="Rarest species" species={stats.rarestSpeciesList} />
			</div>
		</div>
	);
}
