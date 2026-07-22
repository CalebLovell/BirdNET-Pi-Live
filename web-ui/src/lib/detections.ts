import { createServerFn } from "@tanstack/react-start";
import { count, countDistinct, desc, sql } from "drizzle-orm";

import { db } from "#/db/index.ts";
import { type Detection, detections } from "#/db/schema.ts";

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

export type SpeciesSummary = {
	comName: string;
	sciName: string;
	count: number;
	lastDetected: string;
};

export const getSpecies = createServerFn({ method: "GET" }).handler(
	async (): Promise<SpeciesSummary[]> => {
		return db
			.select({
				comName: detections.Com_Name,
				sciName: detections.Sci_Name,
				count: count(),
				lastDetected: sql<string>`max(${detections.Date})`,
			})
			.from(detections)
			.groupBy(detections.Com_Name, detections.Sci_Name)
			.orderBy(sql`count(*) desc`);
	},
);
