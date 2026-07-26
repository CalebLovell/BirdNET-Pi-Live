import { createServerFn } from "@tanstack/react-start";
import { asc, count, countDistinct, desc, inArray, sql } from "drizzle-orm";

import { db } from "~/db/index.ts";
import { detections } from "~/db/schema.ts";
import type { ShareCard } from "~/lib/share-card.ts";
import { countVisitsBySpecies } from "~/lib/visits.ts";

const HOURS = 24;

/**
 * One calendar day shaped for the share card -- the day page's counterpart to
 * buildShareCard's rolling window. Kept out of getDayReview for the same reason
 * that one is kept out of getNowSnapshot: the rarity lookups scan the whole
 * table, and nobody should pay for them unless they open the panel.
 */
export const getDayShareCard = createServerFn({ method: "GET" })
	.validator((date: string) => date)
	.handler(async ({ data: date }): Promise<ShareCard> => {
		const onDay = sql`${detections.Date} = ${date}`;
		const hourExpr = sql<string>`strftime('%H', ${detections.Time})`;

		const [
			[totals],
			[{ speciesCount }],
			visitMoments,
			hourlyRows,
			topRows,
			firstEverRows,
		] = await Promise.all([
			db.select({ detectionCount: count() }).from(detections).where(onDay),
			db
				.select({ speciesCount: countDistinct(detections.Com_Name) })
				.from(detections)
				.where(onDay),
			db
				.select({
					comName: detections.Com_Name,
					timestamp: sql<string>`${detections.Date} || ' ' || ${detections.Time}`,
				})
				.from(detections)
				.where(onDay),
			db
				.select({ hour: hourExpr, count: count() })
				.from(detections)
				.where(onDay)
				.groupBy(hourExpr),
			db
				.select({ comName: detections.Com_Name, count: count() })
				.from(detections)
				.where(onDay)
				.groupBy(detections.Com_Name)
				.orderBy(desc(count()))
				.limit(3),
			// A species belongs here only if its very first detection ever fell on
			// this day, which also means it was heard on it.
			db
				.select({ comName: detections.Com_Name })
				.from(detections)
				.groupBy(detections.Com_Name)
				.having(sql`min(${detections.Date}) = ${date}`),
		]);

		const heardOnDay = db
			.select({ comName: detections.Com_Name })
			.from(detections)
			.where(onDay);

		const [rarest] = await db
			.select({ comName: detections.Com_Name, allTimeCount: count() })
			.from(detections)
			.where(inArray(detections.Com_Name, heardOnDay))
			.groupBy(detections.Com_Name)
			.orderBy(asc(count()))
			.limit(1);

		const hourlyCounts = Array.from({ length: HOURS }, () => 0);
		for (const row of hourlyRows) {
			hourlyCounts[Number(row.hour)] = row.count;
		}

		// A calendar day always reads midnight to midnight, so the sparkline needs
		// no rebasing the way the rolling window does.
		const busiestHour = hourlyCounts.reduce<{
			hour: number;
			count: number;
		} | null>(
			(busiest, value, hour) =>
				value > 0 && (!busiest || value > busiest.count)
					? { hour, count: value }
					: busiest,
			null,
		);

		return {
			date,
			window: "day",
			startHour: 0,
			hourlyCounts,
			species: speciesCount,
			detections: totals.detectionCount,
			visits: countVisitsBySpecies(visitMoments),
			topSpecies: topRows,
			busiestHour,
			firstEver: firstEverRows.map((row) => row.comName),
			rarest: rarest ?? null,
		};
	});
