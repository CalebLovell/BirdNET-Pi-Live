import { createServerFn } from "@tanstack/react-start";
import { count, countDistinct, sql } from "drizzle-orm";

import { db } from "~/db/index.ts";
import { detections } from "~/db/schema.ts";
import type { StatsPeriod } from "~/lib/stats-periods.ts";
import { getTrend, periodFilter, type TrendPoint } from "~/lib/trend.ts";

export type SpeciesCount = { comName: string; count: number };
export type HourActivity = { hour: number; count: number };

export type StatsData = {
	period: StatsPeriod;
	totalDetections: number;
	uniqueSpecies: number;
	topSpecies: SpeciesCount | null;
	busiest: { label: string; count: number } | null;
	trend: TrendPoint[];
	topSpeciesList: SpeciesCount[];
	hourActivity: HourActivity[];
};

async function getTopSpecies(
	period: StatsPeriod,
	limit: number,
): Promise<SpeciesCount[]> {
	return db
		.select({ comName: detections.Com_Name, count: count() })
		.from(detections)
		.where(periodFilter(period))
		.groupBy(detections.Com_Name)
		.orderBy(sql`count(*) desc`)
		.limit(limit);
}

async function getHourActivity(period: StatsPeriod): Promise<HourActivity[]> {
	const rows = await db
		.select({
			hour: sql<string>`strftime('%H', ${detections.Time})`,
			count: count(),
		})
		.from(detections)
		.where(periodFilter(period))
		.groupBy(sql`strftime('%H', ${detections.Time})`);
	const countByHour = new Map(rows.map((r) => [Number(r.hour), r.count]));

	return Array.from({ length: 24 }, (_, hour) => ({
		hour,
		count: countByHour.get(hour) ?? 0,
	}));
}

export const getStatsForPeriod = createServerFn({ method: "GET" })
	.validator((period: StatsPeriod) => period)
	.handler(async ({ data: period }): Promise<StatsData> => {
		const [
			[{ totalDetections }],
			[{ uniqueSpecies }],
			trend,
			topSpeciesList,
			hourActivity,
		] = await Promise.all([
			db
				.select({ totalDetections: count() })
				.from(detections)
				.where(periodFilter(period)),
			db
				.select({ uniqueSpecies: countDistinct(detections.Com_Name) })
				.from(detections)
				.where(periodFilter(period)),
			getTrend(period),
			getTopSpecies(period, 10),
			getHourActivity(period),
		]);

		const busiest = trend.reduce<TrendPoint | null>(
			(max, point) => (!max || point.count > max.count ? point : max),
			null,
		);

		return {
			period,
			totalDetections,
			uniqueSpecies,
			topSpecies: topSpeciesList[0] ?? null,
			busiest: busiest ? { label: busiest.label, count: busiest.count } : null,
			trend,
			topSpeciesList,
			hourActivity,
		};
	});
