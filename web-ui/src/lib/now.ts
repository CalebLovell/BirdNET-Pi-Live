import { createServerFn } from "@tanstack/react-start";
import { and, avg, count, countDistinct, desc, sql } from "drizzle-orm";

import { db } from "~/db/index.ts";
import { detections } from "~/db/schema.ts";
import { audioUrlFor } from "~/lib/audio.ts";
import { illustrationUrlFor } from "~/lib/illustrations.ts";
import { sciNameToSlug } from "~/lib/species-slug.ts";
import {
	countVisits,
	countVisitsBySpecies,
	timestampToMillis,
} from "~/lib/visits.ts";
import { getSpeciesInfo } from "~/lib/wikipedia.ts";

// Every figure on the Now page reads from one rolling 24-hour window rather
// than the calendar day, so no two cards can disagree -- and so the page still
// shows a full night of activity when someone checks it at 1am.
const detectedAt = sql<string>`datetime(${detections.Date} || ' ' || ${detections.Time})`;
const isLast24h = sql`datetime(${detections.Date} || ' ' || ${detections.Time}) >= datetime('now', '-24 hours', 'localtime')`;

export type NowSummary = {
	species: number;
	detections: number;
	visits: number;
	busiestHour: { hour: number; count: number } | null;
};

export type CurrentBird = {
	comName: string;
	sciName: string;
	speciesSlug: string;
	imageUrl: string | null;
	detectedAt: string;
	/** Age at query time, so the first paint already knows the right state. */
	ageMs: number;
	confidence: number | null;
	audioUrl: string | null;
	countLast24h: number;
	visitsLast24h: number;
	averageConfidence: number | null;
	firstHeardLast24h: string | null;
	allTimeCount: number;
};

export type TopSpecies = {
	comName: string;
	sciName: string;
	speciesSlug: string;
	imageUrl: string | null;
	count: number;
};

export type RecentDetection = {
	key: string;
	comName: string;
	sciName: string;
	speciesSlug: string;
	detectedAt: string;
	ageMs: number;
	confidence: number | null;
	audioUrl: string | null;
};

export type NowSnapshot = {
	/** When the server built this snapshot, as "YYYY-MM-DD HH:MM:SS" local. */
	generatedAt: string;
	current: CurrentBird | null;
	summary: NowSummary;
	topSpecies: TopSpecies[];
	recent: RecentDetection[];
};

/**
 * Local wall-clock in the same shape SQLite's datetime() returns, so server- and
 * client-rendered timestamps go through one formatter.
 */
function localTimestamp(date: Date): string {
	const pad = (value: number) => String(value).padStart(2, "0");
	return (
		`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
		` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
	);
}

// The bundled kachō-e illustration when there is one, else Wikipedia's
// thumbnail. getSpeciesInfo memoizes per species, so polling this every ten
// seconds costs one network call per species per server lifetime.
async function imageUrlFor(
	sciName: string,
	comName: string,
): Promise<string | null> {
	return (
		illustrationUrlFor(sciName) ?? (await getSpeciesInfo(comName)).imageUrl
	);
}

type LatestRow = {
	comName: string;
	sciName: string;
	date: string;
	detectedAt: string;
	confidence: number | null;
	fileName: string;
};

async function buildCurrentBird(
	latest: LatestRow,
	generatedAtMs: number,
): Promise<CurrentBird> {
	const isSameSpecies = sql`${detections.Com_Name} = ${latest.comName}`;

	const [[totals], [allTime], moments, imageUrl] = await Promise.all([
		db
			.select({
				countLast24h: count(),
				averageConfidence: avg(detections.Confidence),
				firstHeard: sql<
					string | null
				>`min(datetime(${detections.Date} || ' ' || ${detections.Time}))`,
			})
			.from(detections)
			.where(and(isLast24h, isSameSpecies)),
		db.select({ allTimeCount: count() }).from(detections).where(isSameSpecies),
		db
			.select({ timestamp: detectedAt })
			.from(detections)
			.where(and(isLast24h, isSameSpecies)),
		imageUrlFor(latest.sciName, latest.comName),
	]);

	return {
		comName: latest.comName,
		sciName: latest.sciName,
		speciesSlug: sciNameToSlug(latest.sciName),
		imageUrl,
		detectedAt: latest.detectedAt,
		ageMs: generatedAtMs - timestampToMillis(latest.detectedAt),
		confidence: latest.confidence,
		audioUrl: audioUrlFor(latest.date, latest.comName, latest.fileName),
		countLast24h: totals.countLast24h,
		visitsLast24h: countVisits(moments.map((moment) => moment.timestamp)),
		averageConfidence:
			totals.averageConfidence != null
				? Number(totals.averageConfidence)
				: null,
		firstHeardLast24h: totals.firstHeard,
		allTimeCount: allTime.allTimeCount,
	};
}

export const getNowSnapshot = createServerFn({ method: "GET" }).handler(
	async (): Promise<NowSnapshot> => {
		// Read the clock once, so every age in the snapshot is measured from the
		// same instant and the client can re-base them all off one offset.
		const generatedAtDate = new Date();
		const generatedAtMs = generatedAtDate.getTime();

		const [
			[latest],
			[{ detectionCount }],
			[{ speciesCount }],
			visitMoments,
			[busiest],
			topRows,
			recentRows,
		] = await Promise.all([
			// The one query deliberately NOT bounded to 24 hours: the hero card's
			// quiet state still has to name what was last heard, even if that was
			// days ago. Every other figure on the page respects the window.
			db
				.select({
					comName: detections.Com_Name,
					sciName: detections.Sci_Name,
					date: detections.Date,
					detectedAt,
					confidence: detections.Confidence,
					fileName: detections.File_Name,
				})
				.from(detections)
				.orderBy(desc(detections.Date), desc(detections.Time))
				.limit(1),
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
				.select({
					hour: sql<string>`strftime('%H', ${detections.Time})`,
					count: count(),
				})
				.from(detections)
				.where(isLast24h)
				.groupBy(sql`strftime('%H', ${detections.Time})`)
				.orderBy(sql`count(*) desc`)
				.limit(1),
			db
				.select({
					comName: detections.Com_Name,
					sciName: detections.Sci_Name,
					count: count(),
				})
				.from(detections)
				.where(isLast24h)
				.groupBy(detections.Com_Name, detections.Sci_Name)
				.orderBy(sql`count(*) desc`)
				.limit(5),
			db
				.select({
					comName: detections.Com_Name,
					sciName: detections.Sci_Name,
					date: detections.Date,
					detectedAt,
					confidence: detections.Confidence,
					fileName: detections.File_Name,
				})
				.from(detections)
				.where(isLast24h)
				.orderBy(desc(detections.Date), desc(detections.Time))
				.limit(5),
		]);

		const [current, topSpecies] = await Promise.all([
			latest ? buildCurrentBird(latest, generatedAtMs) : null,
			Promise.all(
				topRows.map(async (row) => ({
					comName: row.comName,
					sciName: row.sciName,
					speciesSlug: sciNameToSlug(row.sciName),
					imageUrl: await imageUrlFor(row.sciName, row.comName),
					count: row.count,
				})),
			),
		]);

		return {
			generatedAt: localTimestamp(generatedAtDate),
			current,
			summary: {
				species: speciesCount,
				detections: detectionCount,
				visits: countVisitsBySpecies(visitMoments),
				busiestHour: busiest
					? { hour: Number(busiest.hour), count: busiest.count }
					: null,
			},
			topSpecies,
			recent: recentRows.map((row) => ({
				key: `${row.detectedAt}-${row.fileName}`,
				comName: row.comName,
				sciName: row.sciName,
				speciesSlug: sciNameToSlug(row.sciName),
				detectedAt: row.detectedAt,
				ageMs: generatedAtMs - timestampToMillis(row.detectedAt),
				confidence: row.confidence,
				audioUrl: audioUrlFor(row.date, row.comName, row.fileName),
			})),
		};
	},
);
