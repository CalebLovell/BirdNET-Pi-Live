import { createServerFn } from "@tanstack/react-start";
import { count, countDistinct, sql } from "drizzle-orm";

import { db } from "~/db/index.ts";
import { detections } from "~/db/schema.ts";
import { illustrationUrlFor } from "~/lib/illustrations.ts";
import {
	type BusiestHour,
	buildDetectionTrend,
	buildHourActivity,
	type HourActivity,
	type SpeciesCount,
	selectBusiestHour,
	selectTrendGranularity,
	type TrendBucketCount,
	type TrendPoint,
} from "~/lib/stats-data.ts";
import { getSpeciesInfo } from "~/lib/wikipedia.ts";

export type StatsData = {
	totalDetections: number;
	uniqueSpecies: number;
	topSpecies: SpeciesCount | null;
	busiestHour: BusiestHour | null;
	topSpeciesList: SpeciesCount[];
	hourActivity: HourActivity[];
	detectionTrend: TrendPoint[];
};

async function getTopSpecies(limit: number): Promise<SpeciesCount[]> {
	const rows = await db
		.select({
			comName: detections.Com_Name,
			sciName: detections.Sci_Name,
			count: count(),
		})
		.from(detections)
		.groupBy(detections.Com_Name, detections.Sci_Name)
		.orderBy(sql`count(*) desc`)
		.limit(limit);

	return Promise.all(
		rows.map(async (row) => {
			const illustrationUrl = illustrationUrlFor(row.sciName);
			const imageUrl = illustrationUrl
				? illustrationUrl
				: (await getSpeciesInfo(row.comName)).imageUrl;

			return { ...row, imageUrl };
		}),
	);
}

async function getHourActivity(): Promise<HourActivity[]> {
	const rows = await db
		.select({
			hour: sql<string>`strftime('%H', ${detections.Time})`,
			count: count(),
		})
		.from(detections)
		.groupBy(sql`strftime('%H', ${detections.Time})`);

	return buildHourActivity(
		rows.map((row) => ({ hour: Number(row.hour), count: row.count })),
	);
}

async function getDetectionTrend(): Promise<TrendPoint[]> {
	const [bounds] = await db
		.select({
			firstDate: sql<string | null>`min(${detections.Date})`,
			lastDate: sql<string | null>`max(${detections.Date})`,
		})
		.from(detections);

	if (!bounds?.firstDate || !bounds.lastDate) return [];

	const granularity = selectTrendGranularity(bounds.firstDate, bounds.lastDate);
	const bucketExpr =
		granularity === "day"
			? sql<string>`${detections.Date}`
			: granularity === "week"
				? sql<string>`date(${detections.Date}, '-' || ((cast(strftime('%w', ${detections.Date}) as integer) + 6) % 7) || ' days')`
				: sql<string>`substr(${detections.Date}, 1, 7)`;

	const rows = await db
		.select({ bucket: bucketExpr, count: count() })
		.from(detections)
		.groupBy(bucketExpr)
		.orderBy(bucketExpr);

	return buildDetectionTrend(
		rows satisfies TrendBucketCount[],
		bounds.firstDate,
		bounds.lastDate,
		granularity,
	);
}

export const getStats = createServerFn({ method: "GET" }).handler(
	async (): Promise<StatsData> => {
		const [
			[{ totalDetections }],
			[{ uniqueSpecies }],
			topSpeciesList,
			hourActivity,
			detectionTrend,
		] = await Promise.all([
			db.select({ totalDetections: count() }).from(detections),
			db
				.select({ uniqueSpecies: countDistinct(detections.Com_Name) })
				.from(detections),
			getTopSpecies(10),
			getHourActivity(),
			getDetectionTrend(),
		]);

		return {
			totalDetections,
			uniqueSpecies,
			topSpecies: topSpeciesList[0] ?? null,
			busiestHour: selectBusiestHour(hourActivity),
			topSpeciesList,
			hourActivity,
			detectionTrend,
		};
	},
);
