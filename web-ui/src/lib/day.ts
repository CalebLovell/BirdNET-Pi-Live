import { createServerFn } from "@tanstack/react-start";
import { count, countDistinct, sql } from "drizzle-orm";

import { db } from "~/db/index.ts";
import { detections } from "~/db/schema.ts";
import { audioUrlFor } from "~/lib/audio.ts";
import { illustrationUrlFor } from "~/lib/illustrations.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";
import { countVisits, localTimestamp } from "~/lib/visits.ts";
import { getSpeciesInfo } from "~/lib/wikipedia.ts";

/** A calendar day identifier, "YYYY-MM-DD". */
export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isDayId(value: string): boolean {
	if (!DAY_PATTERN.test(value)) return false;
	const parsed = new Date(`${value}T00:00:00`);
	return !Number.isNaN(parsed.getTime());
}

export function dayIdFor(date: Date): string {
	return localTimestamp(date).slice(0, 10);
}

export type DayRecording = {
	time: string;
	confidence: number | null;
	audioUrl: string | null;
};

export type DaySpeciesRow = {
	comName: string;
	sciName: string;
	speciesSlug: string;
	imageUrl: string | null;
	count: number;
	visits: number;
	firstTime: string;
	lastTime: string;
	averageConfidence: number | null;
	hourCounts: number[];
	/** A species row exists because it has detections, so it always has a
	    highest-confidence one to offer -- only the clip itself can be missing. */
	bestRecording: DayRecording;
	/** This day is the first this species was ever heard at the station. */
	isFirstEver: boolean;
	/** First time this calendar year, but heard in an earlier year. */
	isFirstThisYear: boolean;
};

export type DayMoment = {
	comName: string;
	speciesSlug: string;
	imageUrl: string | null;
	time: string;
	confidence: number | null;
	audioUrl: string | null;
};

export type DaySummary = {
	species: number;
	detections: number;
	visits: number;
	busiestHour: { hour: number; count: number } | null;
	averageConfidence: number | null;
	firstBird: DayMoment | null;
	lastBird: DayMoment | null;
};

/**
 * Where this day sits among every other recorded day: the average is what a
 * "normal" day looks like at this station, and the rank says whether this one
 * was unusual. Both are what turns a page of counts into a review.
 */
export type DayStanding = {
	/** 1 = the busiest day on record. */
	rank: number;
	daysRecorded: number;
	averageDetections: number;
	averageSpecies: number;
};

export type DayReview = {
	date: string;
	/** "Today", "Yesterday", "3 days ago" -- resolved server-side so the
	    label is identical on both sides of hydration. */
	relativeLabel: string;
	/** Nearest neighbouring days that actually have detections, for paging. */
	previousDate: string | null;
	nextDate: string | null;
	summary: DaySummary;
	standing: DayStanding | null;
	hourActivity: { hour: number; count: number }[];
	species: DaySpeciesRow[];
	/** Highest-confidence clip per species, best first. */
	bestRecordings: (DayRecording & {
		comName: string;
		speciesSlug: string;
		imageUrl: string | null;
	})[];
};

type DetectionRow = {
	comName: string;
	sciName: string;
	time: string;
	confidence: number | null;
	fileName: string;
};

function relativeDayLabel(date: string, today: string): string {
	if (date === today) return "Today";

	const dayMs = 24 * 60 * 60 * 1000;
	const diffDays = Math.round(
		(new Date(`${today}T00:00:00`).getTime() -
			new Date(`${date}T00:00:00`).getTime()) /
			dayMs,
	);

	if (diffDays === 1) return "Yesterday";
	if (diffDays === -1) return "Tomorrow";
	if (diffDays > 1) return `${diffDays} days ago`;
	return `in ${Math.abs(diffDays)} days`;
}

function averageOf(values: (number | null)[]): number | null {
	const present = values.filter((value): value is number => value != null);
	if (present.length === 0) return null;
	return present.reduce((total, value) => total + value, 0) / present.length;
}

function buildSpeciesRows(
	date: string,
	rows: DetectionRow[],
	firstSeen: Map<string, { firstEver: string; firstThisYear: string }>,
): Omit<DaySpeciesRow, "imageUrl">[] {
	const grouped = new Map<string, DetectionRow[]>();
	for (const row of rows) {
		const existing = grouped.get(row.comName);
		if (existing) existing.push(row);
		else grouped.set(row.comName, [row]);
	}

	const year = date.slice(0, 4);

	return Array.from(grouped.values())
		.map((speciesRows) => {
			// Rows arrive ordered by time, so first/last are the ends of the array.
			const first = speciesRows[0];
			const last = speciesRows[speciesRows.length - 1];
			const hourCounts = Array<number>(24).fill(0);
			for (const row of speciesRows) {
				hourCounts[Number(row.time.slice(0, 2))] += 1;
			}

			const best = speciesRows.reduce((leader, row) =>
				(row.confidence ?? 0) > (leader.confidence ?? 0) ? row : leader,
			);
			const seen = firstSeen.get(first.comName);

			return {
				comName: first.comName,
				sciName: first.sciName,
				speciesSlug: comNameToSlug(first.comName),
				count: speciesRows.length,
				visits: countVisits(speciesRows.map((row) => `${date} ${row.time}`)),
				firstTime: first.time,
				lastTime: last.time,
				averageConfidence: averageOf(speciesRows.map((row) => row.confidence)),
				hourCounts,
				bestRecording: {
					time: best.time,
					confidence: best.confidence,
					audioUrl: audioUrlFor(date, best.comName, best.fileName),
				},
				isFirstEver: seen?.firstEver === date,
				isFirstThisYear:
					seen?.firstEver !== date &&
					seen?.firstThisYear === date &&
					// Only meaningful once the station has history from an earlier year.
					(seen?.firstEver ?? "").slice(0, 4) !== year,
			};
		})
		.sort((a, b) => b.count - a.count || a.comName.localeCompare(b.comName));
}

async function imageUrlFor(
	sciName: string,
	comName: string,
): Promise<string | null> {
	return (
		illustrationUrlFor(sciName) ?? (await getSpeciesInfo(comName)).imageUrl
	);
}

/**
 * Everything the day page shows. One pass over the day's rows drives the
 * summary, the per-species table and the hour grid: a day is a few thousand
 * rows at most, and clustering visits is already pure JS (see visits.ts), so
 * grouping in memory keeps all the figures derived from one consistent read.
 */
export const getDayReview = createServerFn({ method: "GET" })
	.validator((date: string) => date)
	.handler(async ({ data: date }): Promise<DayReview> => {
		const onDay = sql`${detections.Date} = ${date}`;
		const today = dayIdFor(new Date());

		const [rows, [previous], [next], dayTotals, firstSeenRows] =
			await Promise.all([
				db
					.select({
						comName: detections.Com_Name,
						sciName: detections.Sci_Name,
						time: detections.Time,
						confidence: detections.Confidence,
						fileName: detections.File_Name,
					})
					.from(detections)
					.where(onDay)
					.orderBy(detections.Time),
				db
					.select({ date: sql<string | null>`max(${detections.Date})` })
					.from(detections)
					.where(sql`${detections.Date} < ${date}`),
				db
					.select({ date: sql<string | null>`min(${detections.Date})` })
					.from(detections)
					.where(sql`${detections.Date} > ${date}`),
				db
					.select({
						date: detections.Date,
						detections: count(),
						species: countDistinct(detections.Com_Name),
					})
					.from(detections)
					.groupBy(detections.Date),
				db
					.select({
						comName: detections.Com_Name,
						firstEver: sql<string>`min(${detections.Date})`,
						firstThisYear: sql<
							string | null
						>`min(case when substr(${detections.Date}, 1, 4) = ${date.slice(0, 4)} then ${detections.Date} end)`,
					})
					.from(detections)
					.groupBy(detections.Com_Name),
			]);

		const firstSeen = new Map(
			firstSeenRows.map((row) => [
				row.comName,
				{ firstEver: row.firstEver, firstThisYear: row.firstThisYear ?? "" },
			]),
		);

		const speciesRows = buildSpeciesRows(date, rows, firstSeen);
		const species = await Promise.all(
			speciesRows.map(async (row) => ({
				...row,
				imageUrl: await imageUrlFor(row.sciName, row.comName),
			})),
		);
		const imageByName = new Map(
			species.map((row) => [row.comName, row.imageUrl]),
		);

		const hourCounts = Array<number>(24).fill(0);
		for (const row of rows) hourCounts[Number(row.time.slice(0, 2))] += 1;
		const hourActivity = hourCounts.map((value, hour) => ({
			hour,
			count: value,
		}));
		const busiestHour = hourActivity.reduce<{
			hour: number;
			count: number;
		} | null>(
			(busiest, point) =>
				point.count > 0 && (!busiest || point.count > busiest.count)
					? point
					: busiest,
			null,
		);

		const momentFor = (row: DetectionRow | undefined): DayMoment | null =>
			row
				? {
						comName: row.comName,
						speciesSlug: comNameToSlug(row.comName),
						imageUrl: imageByName.get(row.comName) ?? null,
						time: row.time,
						confidence: row.confidence,
						audioUrl: audioUrlFor(date, row.comName, row.fileName),
					}
				: null;

		const detectionsToday =
			dayTotals.find((row) => row.date === date)?.detections ?? 0;
		const busierDays = dayTotals.filter(
			(row) => row.detections > detectionsToday,
		).length;
		const standing =
			dayTotals.length > 0 && rows.length > 0
				? {
						rank: busierDays + 1,
						daysRecorded: dayTotals.length,
						averageDetections:
							dayTotals.reduce((total, row) => total + row.detections, 0) /
							dayTotals.length,
						averageSpecies:
							dayTotals.reduce((total, row) => total + row.species, 0) /
							dayTotals.length,
					}
				: null;

		return {
			date,
			relativeLabel: relativeDayLabel(date, today),
			previousDate: previous?.date ?? null,
			nextDate: next?.date ?? null,
			summary: {
				species: species.length,
				detections: rows.length,
				visits: species.reduce((total, row) => total + row.visits, 0),
				busiestHour,
				averageConfidence: averageOf(rows.map((row) => row.confidence)),
				firstBird: momentFor(rows[0]),
				lastBird: momentFor(rows[rows.length - 1]),
			},
			standing,
			hourActivity,
			species,
			bestRecordings: species
				.map((row) => ({
					comName: row.comName,
					speciesSlug: row.speciesSlug,
					imageUrl: row.imageUrl,
					...row.bestRecording,
				}))
				.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
				.slice(0, 6),
		};
	});
