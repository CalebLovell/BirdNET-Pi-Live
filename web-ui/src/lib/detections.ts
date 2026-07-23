import { createServerFn } from "@tanstack/react-start";
import { count, countDistinct, desc, sql } from "drizzle-orm";
import { db } from "#/db/index.ts";
import { type Detection, detections } from "#/db/schema.ts";
import { audioUrlFor } from "#/lib/audio.ts";
import { ebirdUrlFor } from "#/lib/ebird.ts";
import { illustrationUrlFor } from "#/lib/illustrations.ts";
import { getSpeciesInfo } from "#/lib/wikipedia.ts";

const isToday = sql`${detections.Date} = date('now', 'localtime')`;
const isLastHour = sql`datetime(${detections.Date} || ' ' || ${detections.Time}) >= datetime('now', '-1 hour', 'localtime')`;

export type DetectionStats = {
	total: number;
	today: number;
	lastHour: number;
	speciesToday: number;
	speciesAllTime: number;
};

export const getDetectionStats = createServerFn({ method: "GET" }).handler(
	async (): Promise<DetectionStats> => {
		const [{ total }] = await db.select({ total: count() }).from(detections);
		const [{ today }] = await db
			.select({ today: count() })
			.from(detections)
			.where(isToday);
		const [{ lastHour }] = await db
			.select({ lastHour: count() })
			.from(detections)
			.where(isLastHour);
		const [{ speciesToday }] = await db
			.select({ speciesToday: countDistinct(detections.Com_Name) })
			.from(detections)
			.where(isToday);
		const [{ speciesAllTime }] = await db
			.select({ speciesAllTime: countDistinct(detections.Com_Name) })
			.from(detections);

		return { total, today, lastHour, speciesToday, speciesAllTime };
	},
);

export const getRecentDetections = createServerFn({ method: "GET" }).handler(
	async (): Promise<Detection[]> => {
		return db
			.select()
			.from(detections)
			.orderBy(desc(detections.Date), desc(detections.Time))
			.limit(50);
	},
);

export const getDetections = createServerFn({ method: "GET" }).handler(
	async (): Promise<Detection[]> => {
		return db
			.select()
			.from(detections)
			.orderBy(desc(detections.Date), desc(detections.Time))
			.limit(200);
	},
);

export type LifeListCard = {
	comName: string;
	sciName: string;
	hourCount: number;
	allTimeCount: number;
	lastDetected: string;
	audioUrl: string | null;
	imageUrl: string | null;
	wikipediaUrl: string;
	ebirdUrl: string;
};

export const getLifeListCards = createServerFn({ method: "GET" }).handler(
	async (): Promise<LifeListCard[]> => {
		const totals = await db
			.select({
				comName: detections.Com_Name,
				sciName: detections.Sci_Name,
				allTimeCount: count(),
			})
			.from(detections)
			.groupBy(detections.Com_Name, detections.Sci_Name);

		const hourly = await db
			.select({ comName: detections.Com_Name, hourCount: count() })
			.from(detections)
			.where(isLastHour)
			.groupBy(detections.Com_Name);
		const hourByName = new Map(
			hourly.map((row) => [row.comName, row.hourCount]),
		);

		// Most-recent detection per species, ordered so the first occurrence
		// of each Com_Name we see is the latest one.
		const recent = await db
			.select({
				comName: detections.Com_Name,
				date: detections.Date,
				time: detections.Time,
				fileName: detections.File_Name,
			})
			.from(detections)
			.orderBy(desc(detections.Date), desc(detections.Time));
		const latestByName = new Map<
			string,
			{ date: string; time: string; fileName: string }
		>();
		for (const row of recent) {
			if (!latestByName.has(row.comName)) {
				latestByName.set(row.comName, row);
			}
		}

		return Promise.all(
			totals.map(async (row) => {
				const latest = latestByName.get(row.comName);
				const { imageUrl: wikiImageUrl, wikipediaUrl } = await getSpeciesInfo(
					row.comName,
				);
				return {
					comName: row.comName,
					sciName: row.sciName,
					allTimeCount: row.allTimeCount,
					hourCount: hourByName.get(row.comName) ?? 0,
					lastDetected: latest ? `${latest.date} ${latest.time}` : "",
					audioUrl: latest
						? audioUrlFor(latest.date, row.comName, latest.fileName)
						: null,
					imageUrl: illustrationUrlFor(row.sciName) ?? wikiImageUrl,
					wikipediaUrl,
					ebirdUrl: ebirdUrlFor(row.sciName, row.comName),
				};
			}),
		);
	},
);
