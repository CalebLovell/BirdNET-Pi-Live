import { createServerFn } from "@tanstack/react-start";
import { count, countDistinct, sql } from "drizzle-orm";

import { db } from "#/db/index.ts";
import { detections } from "#/db/schema.ts";

export const STATS_PERIODS = ["day", "week", "month", "all"] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];

export const STATS_PERIOD_LABELS: Record<StatsPeriod, string> = {
	day: "Last 24 Hours",
	week: "Last 7 Days",
	month: "Last 30 Days",
	all: "All Time",
};

// Rolling windows (not calendar-day boundaries) so "Last 24 Hours" never
// looks emptied out right after midnight or early in the morning.
const PERIOD_HOURS: Record<StatsPeriod, number | null> = {
	day: 24,
	week: 24 * 7,
	month: 24 * 30,
	all: null,
};

export type TrendPoint = { bucket: string; label: string; count: number };
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

function pad(n: number): string {
	return n.toString().padStart(2, "0");
}

function periodFilter(period: StatsPeriod) {
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

async function daysSinceEarliestDetection(): Promise<number> {
	const [row] = await db
		.select({ minDate: sql<string | null>`min(${detections.Date})` })
		.from(detections);
	if (!row?.minDate) return 1;
	const earliest = new Date(`${row.minDate}T00:00:00`);
	const diffDays =
		Math.floor((Date.now() - earliest.getTime()) / (1000 * 60 * 60 * 24)) + 1;
	return Math.min(MAX_ALL_TIME_DAYS, Math.max(1, diffDays));
}

async function getTrend(period: StatsPeriod): Promise<TrendPoint[]> {
	const isHourly = period === "day";
	const bucketExpr = isHourly
		? sql<string>`strftime('%Y-%m-%dT%H:00:00', ${detections.Date} || ' ' || ${detections.Time})`
		: sql<string>`${detections.Date}`;

	const rows = await db
		.select({ bucket: bucketExpr, count: count() })
		.from(detections)
		.where(periodFilter(period))
		.groupBy(bucketExpr);
	const countByBucket = new Map(rows.map((r) => [r.bucket, r.count]));

	const expected = isHourly
		? hourBuckets(PERIOD_HOURS.day as number)
		: dayBuckets(
				period === "week"
					? 7
					: period === "month"
						? 30
						: await daysSinceEarliestDetection(),
			);

	return expected.map(({ key, label }) => ({
		bucket: key,
		label,
		count: countByBucket.get(key) ?? 0,
	}));
}

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
