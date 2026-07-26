import { createServerFn } from "@tanstack/react-start";
import { asc, count, countDistinct, desc, inArray, sql } from "drizzle-orm";

import { db } from "~/db/index.ts";
import { detections } from "~/db/schema.ts";
import { detectedAt, isLast24h } from "~/lib/now.ts";
import type { ShareCard } from "~/lib/share-card.ts";
import { countVisitsBySpecies } from "~/lib/visits.ts";

const HOURS = 24;

// Whole hours between a detection and now. Bucketing by elapsed hours rather
// than by clock hour keeps the buckets disjoint: the window rolls, so the hour
// it starts in is the same hour it ends in, and strftime would fold the two
// halves of that hour into one cell.
const hoursAgo = sql<number>`cast((julianday('now', 'localtime') - julianday(${detectedAt})) * 24 as integer)`;

/**
 * The Today page's rolling 24 hours, shaped for the share card.
 *
 * Kept apart from getNowSnapshot deliberately: that snapshot re-fetches every
 * ten seconds, and the two all-time lookups below have no business riding
 * along on every poll. This runs once, when the panel is first opened.
 */
export async function buildShareCard(): Promise<ShareCard> {
	const generatedAt = new Date();

	const [
		[totals],
		[{ speciesCount }],
		visitMoments,
		hourlyRows,
		topRows,
		[busiest],
		firstEverRows,
	] = await Promise.all([
		db.select({ detectionCount: count() }).from(detections).where(isLast24h),
		db
			.select({ speciesCount: countDistinct(detections.Com_Name) })
			.from(detections)
			.where(isLast24h),
		db
			.select({ comName: detections.Com_Name, timestamp: detectedAt })
			.from(detections)
			.where(isLast24h),
		db
			.select({ hoursAgo, count: count() })
			.from(detections)
			.where(isLast24h)
			.groupBy(hoursAgo),
		db
			.select({ comName: detections.Com_Name, count: count() })
			.from(detections)
			.where(isLast24h)
			.groupBy(detections.Com_Name)
			.orderBy(desc(count()))
			.limit(3),
		db
			.select({
				hour: sql<string>`strftime('%H', ${detections.Time})`,
				count: count(),
			})
			.from(detections)
			.where(isLast24h)
			.groupBy(sql`strftime('%H', ${detections.Time})`)
			.orderBy(desc(count()))
			.limit(1),
		// A species belongs here only if its very first detection ever landed
		// inside the window, which also means it was heard in the window.
		db
			.select({ comName: detections.Com_Name })
			.from(detections)
			.groupBy(detections.Com_Name)
			.having(
				sql`min(${detectedAt}) >= datetime('now', '-24 hours', 'localtime')`,
			),
	]);

	const heardToday = db
		.select({ comName: detections.Com_Name })
		.from(detections)
		.where(isLast24h);

	const [rarest] = await db
		.select({ comName: detections.Com_Name, allTimeCount: count() })
		.from(detections)
		.where(inArray(detections.Com_Name, heardToday))
		.groupBy(detections.Com_Name)
		.orderBy(asc(count()))
		.limit(1);

	// Oldest bucket first, so the line reads left to right into the present.
	const hourlyCounts = Array.from({ length: HOURS }, () => 0);
	for (const row of hourlyRows) {
		const index = HOURS - 1 - Number(row.hoursAgo);
		if (index >= 0 && index < HOURS) hourlyCounts[index] = row.count;
	}

	return {
		date: `${generatedAt.getFullYear()}-${String(
			generatedAt.getMonth() + 1,
		).padStart(2, "0")}-${String(generatedAt.getDate()).padStart(2, "0")}`,
		// The window opened exactly 24 hours ago, which is the same clock hour
		// it is now, one day back.
		startHour: generatedAt.getHours(),
		hourlyCounts,
		species: speciesCount,
		detections: totals.detectionCount,
		visits: countVisitsBySpecies(visitMoments),
		topSpecies: topRows,
		busiestHour: busiest
			? { hour: Number(busiest.hour), count: busiest.count }
			: null,
		firstEver: firstEverRows.map((row) => row.comName),
		rarest: rarest ?? null,
	};
}

export const getShareCard = createServerFn({ method: "GET" }).handler(
	buildShareCard,
);
