import { count, type SQL, sql } from "drizzle-orm";

import { db } from "#/db/index.ts";
import { detections } from "#/db/schema.ts";
import type { StatsPeriod } from "#/lib/stats-periods.ts";

// Rolling windows (not calendar-day boundaries) so "Last 24 Hours" never
// looks emptied out right after midnight or early in the morning.
const PERIOD_HOURS: Record<StatsPeriod, number | null> = {
	day: 24,
	week: 24 * 7,
	month: 24 * 30,
	all: null,
};

export type TrendPoint = { bucket: string; label: string; count: number };

function pad(n: number): string {
	return n.toString().padStart(2, "0");
}

export function periodFilter(period: StatsPeriod): SQL {
	const hours = PERIOD_HOURS[period];
	if (hours === null) return sql`1=1`;
	return sql`datetime(${detections.Date} || ' ' || ${detections.Time}) >= datetime('now', ${`-${hours} hours`}, 'localtime')`;
}

function hourBuckets(hoursBack: number): { key: string; label: string }[] {
	const now = new Date();
	const buckets: { key: string; label: string }[] = [];
	for (let i = hoursBack - 1; i >= 0; i--) {
		const d = new Date(now.getTime() - i * 60 * 60 * 1000);
		d.setMinutes(0, 0, 0);
		const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00:00`;
		const label = d.toLocaleTimeString([], { hour: "numeric" });
		buckets.push({ key, label });
	}
	return buckets;
}

function dayBuckets(daysBack: number): { key: string; label: string }[] {
	const now = new Date();
	const buckets: { key: string; label: string }[] = [];
	for (let i = daysBack - 1; i >= 0; i--) {
		const d = new Date(now);
		d.setDate(d.getDate() - i);
		const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
		const label = d.toLocaleDateString([], { month: "short", day: "numeric" });
		buckets.push({ key, label });
	}
	return buckets;
}

const MAX_ALL_TIME_DAYS = 365;

async function daysSinceEarliestDetection(extraFilter?: SQL): Promise<number> {
	const query = db
		.select({ minDate: sql<string | null>`min(${detections.Date})` })
		.from(detections);
	const [row] = extraFilter ? await query.where(extraFilter) : await query;
	if (!row?.minDate) return 1;
	const earliest = new Date(`${row.minDate}T00:00:00`);
	const diffDays =
		Math.floor((Date.now() - earliest.getTime()) / (1000 * 60 * 60 * 24)) + 1;
	return Math.min(MAX_ALL_TIME_DAYS, Math.max(1, diffDays));
}

/** Detections-over-time trend, optionally narrowed by an extra SQL filter
 * (e.g. a single species) on top of the period's rolling time window. */
export async function getTrend(
	period: StatsPeriod,
	extraFilter?: SQL,
): Promise<TrendPoint[]> {
	const isHourly = period === "day";
	const bucketExpr = isHourly
		? sql<string>`strftime('%Y-%m-%dT%H:00:00', ${detections.Date} || ' ' || ${detections.Time})`
		: sql<string>`${detections.Date}`;

	const where = extraFilter
		? sql`(${periodFilter(period)}) AND (${extraFilter})`
		: periodFilter(period);

	const rows = await db
		.select({ bucket: bucketExpr, count: count() })
		.from(detections)
		.where(where)
		.groupBy(bucketExpr);
	const countByBucket = new Map(rows.map((r) => [r.bucket, r.count]));

	const expected = isHourly
		? hourBuckets(PERIOD_HOURS.day as number)
		: dayBuckets(
				period === "week"
					? 7
					: period === "month"
						? 30
						: await daysSinceEarliestDetection(extraFilter),
			);

	return expected.map(({ key, label }) => ({
		bucket: key,
		label,
		count: countByBucket.get(key) ?? 0,
	}));
}
