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
import {
	type SpeciesActivityItem,
	SpeciesActivityList,
} from "~/components/species-activity-list.tsx";
import { SpeciesList } from "~/components/species-list.tsx";
import { TooltipProvider } from "~/components/ui/tooltip.tsx";
import {
	ARRIVAL_WINDOW_DAYS,
	QUIET_AFTER_DAYS,
	RESIDENT_MIN_DAYS,
	shortDateLabel,
} from "~/lib/migration-data.ts";
import { pageTitle } from "~/lib/page-title.ts";
import { getStats } from "~/lib/stats.ts";
import { dayLabel, hourLabel } from "~/lib/stats-data.ts";

export const Route = createFileRoute("/stats")({
	head: () => ({ meta: [{ title: pageTitle("Stats") }] }),
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

	// Both cards date their rows by the marker detection each one stands on --
	// the last one heard, or the first of an arrival.
	const quietItems: SpeciesActivityItem[] = stats.quietSpecies.map((item) => ({
		comName: item.comName,
		sciName: item.sciName,
		imageUrl: item.imageUrl,
		detectedAt: item.detectedAt,
		ageMs: item.ageMs,
		timeLabel: shortDateLabel(item.lastSeen),
		confidence: item.confidence,
		audioUrl: item.audioUrl,
	}));

	const arrivalItems: SpeciesActivityItem[] = stats.newArrivals.map((item) => ({
		comName: item.comName,
		sciName: item.sciName,
		imageUrl: item.imageUrl,
		detectedAt: item.detectedAt,
		ageMs: item.ageMs,
		timeLabel: shortDateLabel(item.firstSeen),
		confidence: item.confidence,
		audioUrl: item.audioUrl,
	}));

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

				<TooltipProvider>
					<SpeciesActivityList
						title="New arrivals"
						description={`Species heard in the last ${ARRIVAL_WINDOW_DAYS} days that were absent for the ${ARRIVAL_WINDOW_DAYS} days before that — new sightings and returning migrants alike.`}
						species={arrivalItems}
						emptyMessage="No new arrivals in the last two weeks."
					/>
					<SpeciesActivityList
						title="Gone quiet"
						description={`Regular visitors — heard on at least ${RESIDENT_MIN_DAYS} separate days — with no detection in the last ${QUIET_AFTER_DAYS} days. They may have migrated away or shifted territory.`}
						species={quietItems}
						emptyMessage="Every regular visitor has been heard recently."
					/>
				</TooltipProvider>
			</div>
		</div>
	);
}
