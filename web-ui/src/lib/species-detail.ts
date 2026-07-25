import { createServerFn } from "@tanstack/react-start";
import { avg, desc, sql } from "drizzle-orm";

import { db } from "~/db/index.ts";
import { detections } from "~/db/schema.ts";
import { audioUrlFor } from "~/lib/audio.ts";
import { ebirdUrlFor } from "~/lib/ebird.ts";
import { illustrationUrlFor } from "~/lib/illustrations.ts";
import { slugToSciNameQuery } from "~/lib/species-slug.ts";
import { getYearTrend, type TrendPoint, yearFilter } from "~/lib/trend.ts";
import { localTimestamp, timestampToMillis } from "~/lib/visits.ts";
import { getSpeciesInfo } from "~/lib/wikipedia.ts";

export type HourActivity = { hour: number; count: number };
export type Visit = {
	date: string;
	time: string;
	confidence: number | null;
	audioUrl?: string | null;
};
/**
 * A visit the log renders as "4:13 AM / 27 minutes ago". The age is measured
 * on the server, the same way the Now page measures its rows, so both sides of
 * hydration render an identical label from identical data.
 */
export type RecentVisit = Visit & { ageMs: number };
export type BestRecording = {
	date: string;
	time: string;
	confidence: number | null;
	audioUrl: string | null;
};

export type SpeciesDetail = {
	comName: string;
	sciName: string;
	imageUrl: string | null;
	ebirdUrl: string;
	totalDetections: number;
	availableYears: number[];
	firstDetected: Visit;
	lastDetected: Visit;
	averageConfidence: number | null;
	history: TrendPoint[];
	hourActivity: HourActivity[];
	bestRecording: BestRecording | null;
	recentVisits: RecentVisit[];
	/** When the visit ages were measured, for `useAgeOffset` to advance them. */
	generatedAt: string;
};

function bySciNameSlug(slug: string) {
	return sql`lower(${detections.Sci_Name}) = ${slugToSciNameQuery(slug)}`;
}

async function getHourActivity(
	filter: ReturnType<typeof bySciNameSlug>,
	year: number,
) {
	const rows = await db
		.select({
			hour: sql<string>`strftime('%H', ${detections.Time})`,
			count: sql<number>`count(*)`,
		})
		.from(detections)
		.where(sql`(${yearFilter(year)}) AND (${filter})`)
		.groupBy(sql`strftime('%H', ${detections.Time})`);
	const countByHour = new Map(rows.map((r) => [Number(r.hour), r.count]));

	return Array.from({ length: 24 }, (_, hour) => ({
		hour,
		count: countByHour.get(hour) ?? 0,
	}));
}

export type SpeciesDetailInput = { sciNameSlug: string; year: number };

export const getSpeciesDetail = createServerFn({ method: "GET" })
	.validator((input: SpeciesDetailInput) => input)
	.handler(
		async ({ data: { sciNameSlug, year } }): Promise<SpeciesDetail | null> => {
			const filter = bySciNameSlug(sciNameSlug);
			const generatedAtDate = new Date();
			const generatedAtMs = generatedAtDate.getTime();

			const [totals] = await db
				.select({
					comName: detections.Com_Name,
					sciName: detections.Sci_Name,
					totalDetections: sql<number>`count(*)`,
					averageConfidence: avg(detections.Confidence),
				})
				.from(detections)
				.where(filter)
				.groupBy(detections.Com_Name, detections.Sci_Name);

			if (!totals || totals.totalDetections === 0) return null;
			const comName = totals.comName;

			const [
				[first],
				[last],
				[best],
				recentVisits,
				availableYearRows,
				history,
				hourActivity,
				{ imageUrl: wikiImageUrl },
			] = await Promise.all([
				db
					.select({
						date: detections.Date,
						time: detections.Time,
						confidence: detections.Confidence,
					})
					.from(detections)
					.where(filter)
					.orderBy(detections.Date, detections.Time)
					.limit(1),
				db
					.select({
						date: detections.Date,
						time: detections.Time,
						confidence: detections.Confidence,
					})
					.from(detections)
					.where(filter)
					.orderBy(desc(detections.Date), desc(detections.Time))
					.limit(1),
				db
					.select({
						date: detections.Date,
						time: detections.Time,
						confidence: detections.Confidence,
						fileName: detections.File_Name,
					})
					.from(detections)
					.where(filter)
					.orderBy(desc(detections.Confidence))
					.limit(1),
				db
					.select({
						date: detections.Date,
						time: detections.Time,
						confidence: detections.Confidence,
						fileName: detections.File_Name,
					})
					.from(detections)
					.where(filter)
					.orderBy(desc(detections.Date), desc(detections.Time))
					.limit(9), // odd count so the visit log's zebra striping starts and ends on the tinted row
				db
					.select({
						year: sql<number>`cast(substr(${detections.Date}, 1, 4) as integer)`,
					})
					.from(detections)
					.where(filter)
					.groupBy(sql`cast(substr(${detections.Date}, 1, 4) as integer)`)
					.orderBy(
						desc(sql`cast(substr(${detections.Date}, 1, 4) as integer)`),
					),
				getYearTrend(year, filter),
				getHourActivity(filter, year),
				getSpeciesInfo(comName),
			]);

			return {
				comName,
				sciName: totals.sciName,
				imageUrl: illustrationUrlFor(totals.sciName) ?? wikiImageUrl,
				ebirdUrl: ebirdUrlFor(totals.sciName, comName),
				totalDetections: totals.totalDetections,
				availableYears: availableYearRows.map((row) => row.year),
				firstDetected: first ?? { date: "", time: "", confidence: null },
				lastDetected: last ?? { date: "", time: "", confidence: null },
				averageConfidence: totals.averageConfidence
					? Number(totals.averageConfidence)
					: null,
				history,
				hourActivity,
				bestRecording: best
					? {
							date: best.date,
							time: best.time,
							confidence: best.confidence,
							audioUrl: audioUrlFor(best.date, comName, best.fileName),
						}
					: null,
				recentVisits: recentVisits.map((visit) => ({
					date: visit.date,
					time: visit.time,
					confidence: visit.confidence,
					audioUrl: audioUrlFor(visit.date, comName, visit.fileName),
					ageMs:
						generatedAtMs - timestampToMillis(`${visit.date} ${visit.time}`),
				})),
				generatedAt: localTimestamp(generatedAtDate),
			};
		},
	);
