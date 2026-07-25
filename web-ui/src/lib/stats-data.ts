export type HourActivity = { hour: number; count: number };
export type BusiestHour = HourActivity;
export type TrendGranularity = "day" | "week" | "month";
export type TrendBucketCount = { bucket: string; count: number };
export type TrendPoint = TrendBucketCount & { label: string };
export type SpeciesCount = {
	comName: string;
	sciName: string;
	count: number;
	imageUrl: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDate(value: string): Date {
	return new Date(`${value}T00:00:00Z`);
}

function isoDay(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function startOfWeek(date: Date): Date {
	const result = new Date(date);
	const daysSinceMonday = (result.getUTCDay() + 6) % 7;
	result.setUTCDate(result.getUTCDate() - daysSinceMonday);
	return result;
}

function bucketStart(date: Date, granularity: TrendGranularity): Date {
	if (granularity === "week") return startOfWeek(date);
	if (granularity === "month") {
		return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
	}
	return new Date(date);
}

function nextBucket(date: Date, granularity: TrendGranularity): Date {
	const result = new Date(date);
	if (granularity === "month") {
		result.setUTCMonth(result.getUTCMonth() + 1);
	} else {
		result.setUTCDate(result.getUTCDate() + (granularity === "week" ? 7 : 1));
	}
	return result;
}

function bucketKey(date: Date, granularity: TrendGranularity): string {
	return granularity === "month" ? isoDay(date).slice(0, 7) : isoDay(date);
}

const DAY_LABEL = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC",
});

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
	month: "long",
	year: "numeric",
	timeZone: "UTC",
});

function bucketLabel(date: Date, granularity: TrendGranularity): string {
	if (granularity === "month") return MONTH_LABEL.format(date);
	const label = DAY_LABEL.format(date);
	return granularity === "week" ? `Week of ${label}` : label;
}

export function selectTrendGranularity(
	firstDate: string,
	lastDate: string,
): TrendGranularity {
	const spanDays =
		Math.floor(
			(parseIsoDate(lastDate).getTime() - parseIsoDate(firstDate).getTime()) /
				DAY_MS,
		) + 1;

	if (spanDays <= 120) return "day";
	if (spanDays <= 730) return "week";
	return "month";
}

export function buildDetectionTrend(
	rows: TrendBucketCount[],
	firstDate: string | null,
	lastDate: string | null,
	granularity: TrendGranularity,
): TrendPoint[] {
	if (!firstDate || !lastDate) return [];

	const first = parseIsoDate(firstDate);
	const last = parseIsoDate(lastDate);
	if (
		Number.isNaN(first.getTime()) ||
		Number.isNaN(last.getTime()) ||
		first > last
	) {
		return [];
	}

	const countByBucket = new Map(rows.map((row) => [row.bucket, row.count]));
	const end = bucketStart(last, granularity);
	const points: TrendPoint[] = [];

	for (
		let current = bucketStart(first, granularity);
		current <= end;
		current = nextBucket(current, granularity)
	) {
		const bucket = bucketKey(current, granularity);
		points.push({
			bucket,
			label: bucketLabel(current, granularity),
			count: countByBucket.get(bucket) ?? 0,
		});
	}

	return points;
}

export function buildHourActivity(rows: HourActivity[]): HourActivity[] {
	const countByHour = new Map(rows.map((row) => [row.hour, row.count]));

	return Array.from({ length: 24 }, (_, hour) => ({
		hour,
		count: countByHour.get(hour) ?? 0,
	}));
}

export function selectBusiestHour(
	activity: HourActivity[],
): BusiestHour | null {
	return activity.reduce<BusiestHour | null>(
		(busiest, point) =>
			point.count > 0 && (!busiest || point.count > busiest.count)
				? point
				: busiest,
		null,
	);
}

export function hourLabel(hour: number): string {
	if (hour === 0) return "12 AM";
	if (hour < 12) return `${hour} AM`;
	if (hour === 12) return "12 PM";
	return `${hour - 12} PM`;
}

export function rankingBarPercent(count: number, maximum: number): number {
	if (count <= 0 || maximum <= 0) return 0;
	return Math.max(2, Math.round((count / maximum) * 100));
}
