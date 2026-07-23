import { createServerFn } from "@tanstack/react-start";
import { avg, countDistinct, desc, sql } from "drizzle-orm";

import { db } from "#/db/index.ts";
import { detections } from "#/db/schema.ts";
import { audioUrlFor } from "#/lib/audio.ts";
import { ebirdUrlFor } from "#/lib/ebird.ts";
import { illustrationUrlFor } from "#/lib/illustrations.ts";
import { slugToSciNameQuery } from "#/lib/species-slug.ts";
import type { StatsPeriod } from "#/lib/stats-periods.ts";
import { getTrend, type TrendPoint } from "#/lib/trend.ts";
import { getSpeciesInfo } from "#/lib/wikipedia.ts";

export type HourActivity = { hour: number; count: number };
export type Visit = { date: string; time: string; confidence: number | null };
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
	wikipediaUrl: string;
	ebirdUrl: string;
	totalDetections: number;
	firstDetected: Visit;
	lastDetected: Visit;
	latestAudioUrl: string | null;
	daysActive: number;
	averageConfidence: number | null;
	history: TrendPoint[];
	hourActivity: HourActivity[];
	bestRecording: BestRecording | null;
	recentVisits: Visit[];
};

function bySciNameSlug(slug: string) {
	return sql`lower(${detections.Sci_Name}) = ${slugToSciNameQuery(slug)}`;
}

async function getHourActivity(filter: ReturnType<typeof bySciNameSlug>) {
	const rows = await db
		.select({
			hour: sql<string>`strftime('%H', ${detections.Time})`,
			count: sql<number>`count(*)`,
		})
		.from(detections)
		.where(filter)
		.groupBy(sql`strftime('%H', ${detections.Time})`);
	const countByHour = new Map(rows.map((r) => [Number(r.hour), r.count]));

	return Array.from({ length: 24 }, (_, hour) => ({
		hour,
		count: countByHour.get(hour) ?? 0,
	}));
}

export type SpeciesDetailInput = { sciNameSlug: string; period: StatsPeriod };

export const getSpeciesDetail = createServerFn({ method: "GET" })
	.validator((input: SpeciesDetailInput) => input)
	.handler(
		async ({
			data: { sciNameSlug, period },
		}): Promise<SpeciesDetail | null> => {
			const filter = bySciNameSlug(sciNameSlug);

			const [totals] = await db
				.select({
					comName: detections.Com_Name,
					sciName: detections.Sci_Name,
					totalDetections: sql<number>`count(*)`,
					averageConfidence: avg(detections.Confidence),
					daysActive: countDistinct(detections.Date),
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
				history,
				hourActivity,
				{ imageUrl: wikiImageUrl, wikipediaUrl },
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
						fileName: detections.File_Name,
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
					})
					.from(detections)
					.where(filter)
					.orderBy(desc(detections.Date), desc(detections.Time))
					.limit(10),
				getTrend(period, filter),
				getHourActivity(filter),
				getSpeciesInfo(comName),
			]);

			return {
				comName,
				sciName: totals.sciName,
				imageUrl: illustrationUrlFor(totals.sciName) ?? wikiImageUrl,
				wikipediaUrl,
				ebirdUrl: ebirdUrlFor(totals.sciName, comName),
				totalDetections: totals.totalDetections,
				firstDetected: first ?? { date: "", time: "", confidence: null },
				lastDetected: last ?? { date: "", time: "", confidence: null },
				latestAudioUrl: last
					? audioUrlFor(last.date, comName, last.fileName)
					: null,
				daysActive: totals.daysActive,
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
				recentVisits,
			};
		},
	);
