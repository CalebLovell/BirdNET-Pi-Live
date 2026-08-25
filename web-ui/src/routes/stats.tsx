import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import {
	Bird,
	CalendarDays,
	ChartNoAxesColumnIncreasing,
	Clock3,
	Feather,
} from "lucide-react";
import { z } from "zod";

import { DetectionsByHourCard } from "~/components/detections-by-hour-card.tsx";
import { DetectionsByMonthCard } from "~/components/detections-by-month-card.tsx";
import { EmptyState } from "~/components/empty-state.tsx";
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
import { dayLabel } from "~/lib/stats-data.ts";
import { hourLabel } from "~/lib/time-ago.ts";

// The by-month chart shows one calendar year at a time; the year lives in the
// URL so a particular year is a link someone can keep.
const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 2000;
const DEFAULT_YEAR = CURRENT_YEAR;

const statsSearchSchema = z.object({
	year: z.coerce
		.number()
		.int()
		.min(MIN_YEAR)
		.max(CURRENT_YEAR)
		.default(DEFAULT_YEAR)
		.catch(DEFAULT_YEAR),
});

export const Route = createFileRoute("/stats")({
	validateSearch: statsSearchSchema,
	search: {
		middlewares: [stripSearchParams({ year: DEFAULT_YEAR })],
	},
	loaderDeps: ({ search }) => ({ year: search.year }),
	head: () => ({ meta: [{ title: pageTitle("Stats") }] }),
	loader: ({ deps }) => getStats({ data: { year: deps.year } }),
	component: Stats,
});

function Stats() {
	const stats = Route.useLoaderData();
	const { year } = Route.useSearch();
	const navigate = Route.useNavigate();

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

			{/* Six cards, four of them repeating the same sentence, is a worse way
			    of saying "nothing here yet" than saying it once. Every figure on
			    this page is derived from detections, so with none there is nothing
			    for any of the cards to be about. */}
			{isEmpty ? (
				<EmptyState icon={Bird} title="No detections recorded yet.">
					Once the station has heard something, its figures will break down here
					by species, day and hour.
				</EmptyState>
			) : (
				<div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
					<DetectionsByHourCard activity={stats.hourActivity} />
					<DetectionsByMonthCard
						trend={stats.detectionTrend}
						year={year}
						years={stats.availableYears}
						onYearChange={(next) =>
							navigate({
								search: (prev) => ({ ...prev, year: next }),
								replace: true,
							})
						}
					/>
					{/* No min-height: the two lists sit in the same grid row, so they
				    already stretch to match each other. Reserving height instead only
				    padded them with dead space until the lists were long enough. */}
					<SpeciesList title="Top species" species={stats.topSpeciesList} />
					<SpeciesList
						title="Rarest species"
						species={stats.rarestSpeciesList}
					/>

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
			)}
		</div>
	);
}
