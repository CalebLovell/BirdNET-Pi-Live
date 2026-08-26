import { count, countDistinct, sql } from "drizzle-orm";

import { db } from "~/db/index.ts";
import { detections } from "~/db/schema.ts";
import { illustrationUrlFor } from "~/lib/illustrations.ts";
import { getNewArrivals, getQuietSpecies } from "~/lib/migration.ts";
import type { ArrivalSpecies, QuietSpecies } from "~/lib/migration-data.ts";
import {
	type BusiestDay,
	type BusiestHour,
	buildHourActivity,
	type HourActivity,
	type SpeciesCount,
	selectBusiestHour,
} from "~/lib/stats-data.ts";
import { getSpeciesInfo } from "~/lib/wikipedia.ts";

export type StatsData = {
	totalDetections: number;
	uniqueSpecies: number;
	busiestDay: BusiestDay | null;
	busiestHour: BusiestHour | null;
	topSpeciesList: SpeciesCount[];
	rarestSpeciesList: SpeciesCount[];
	hourActivity: HourActivity[];
	quietSpecies: QuietSpecies[];
	newArrivals: ArrivalSpecies[];
};

async function getSpeciesRanking(
	limit: number,
	direction: "most" | "least",
): Promise<SpeciesCount[]> {
	const rows = await db
		.select({
			comName: detections.Com_Name,
			sciName: detections.Sci_Name,
			count: count(),
		})
		.from(detections)
		.groupBy(detections.Com_Name, detections.Sci_Name)
		.orderBy(
			direction === "most" ? sql`count(*) desc` : sql`count(*) asc`,
			detections.Com_Name,
		)
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

async function getBusiestDay(): Promise<BusiestDay | null> {
	const [row] = await db
		.select({ date: detections.Date, count: count() })
		.from(detections)
		.groupBy(detections.Date)
		.orderBy(sql`count(*) desc`, detections.Date)
		.limit(1);

	return row ?? null;
}

/**
 * The all-time half of the timeline page: totals, rankings and the two
 * migration lists. Everything here spans the station's whole history, so
 * unlike the rest of that page it takes no window -- it is only ever asked
 * for under the "All time" period.
 *
 * A plain function rather than a server function: `timeline-page.ts` composes it
 * with the window queries into a single round trip.
 */
export async function loadAllTimeStats(): Promise<StatsData> {
	const [
		[{ totalDetections }],
		[{ uniqueSpecies }],
		busiestDay,
		topSpeciesList,
		rarestSpeciesList,
		hourActivity,
		quietSpecies,
		newArrivals,
	] = await Promise.all([
		db.select({ totalDetections: count() }).from(detections),
		db
			.select({ uniqueSpecies: countDistinct(detections.Com_Name) })
			.from(detections),
		getBusiestDay(),
		getSpeciesRanking(10, "most"),
		getSpeciesRanking(10, "least"),
		getHourActivity(),
		getQuietSpecies(),
		getNewArrivals(),
	]);

	return {
		totalDetections,
		uniqueSpecies,
		busiestDay,
		busiestHour: selectBusiestHour(hourActivity),
		topSpeciesList,
		rarestSpeciesList,
		hourActivity,
		quietSpecies,
		newArrivals,
	};
}
