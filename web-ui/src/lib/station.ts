import { createServerFn } from "@tanstack/react-start";
import { count, countDistinct, desc } from "drizzle-orm";

import { db } from "~/db/index.ts";
import { detections } from "~/db/schema.ts";
import { detectedAt, isLast24h } from "~/lib/now.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";
import { localTimestamp, timestampToMillis } from "~/lib/visits.ts";

export type StationLatest = {
	comName: string;
	speciesSlug: string;
	/** Age at query time, so the sidebar ages it forward from a known point. */
	ageMs: number;
};

export type StationStatus = {
	/** When the server built this reading, as "YYYY-MM-DD HH:MM:SS" local. */
	generatedAt: string;
	latest: StationLatest | null;
	species24h: number;
	detections24h: number;
};

/**
 * The station's liveness for the sidebar, which every page shows.
 *
 * Deliberately much smaller than `getNowSnapshot`: no images, averages or visit
 * maths. The sidebar polls this from every route, so it stays three bounded
 * queries -- anything heavier would tax the Pi for a three-line status block.
 */
export const getStationStatus = createServerFn({ method: "GET" }).handler(
	async (): Promise<StationStatus> => {
		// One clock reading for the whole result, so the age and the timestamp
		// describe the same instant.
		const generatedAtDate = new Date();
		const generatedAtMs = generatedAtDate.getTime();

		const [[latest], [{ species24h }], [{ detections24h }]] = await Promise.all(
			[
				// Unbounded, like the Today hero: the sidebar names the most recent
				// detection however old it is, rather than going blank on a quiet day.
				db
					.select({ comName: detections.Com_Name, detectedAt })
					.from(detections)
					.orderBy(desc(detections.Date), desc(detections.Time))
					.limit(1),
				db
					.select({ species24h: countDistinct(detections.Com_Name) })
					.from(detections)
					.where(isLast24h),
				db.select({ detections24h: count() }).from(detections).where(isLast24h),
			],
		);

		return {
			generatedAt: localTimestamp(generatedAtDate),
			latest: latest
				? {
						comName: latest.comName,
						speciesSlug: comNameToSlug(latest.comName),
						ageMs: generatedAtMs - timestampToMillis(latest.detectedAt),
					}
				: null,
			species24h,
			detections24h,
		};
	},
);

/**
 * The 24-hour tally line, e.g. "31 species · 412 calls". Pure so it can be
 * tested without a database, and so the sidebar renders the same string on
 * both sides of hydration.
 */
export function formatStationTally(
	species24h: number,
	detections24h: number,
): string {
	return `${species24h} species · ${detections24h} ${detections24h === 1 ? "call" : "calls"}`;
}
