import { createServerFn } from "@tanstack/react-start";
import { sql } from "drizzle-orm";

import { db } from "~/db/index.ts";
import { detections } from "~/db/schema.ts";
import { ebirdUrlFor } from "~/lib/ebird.ts";
import { illustrationUrlFor } from "~/lib/illustrations.ts";
import type { TimelinePeriod } from "~/lib/timeline-periods.ts";
import { getSpeciesInfo } from "~/lib/wikipedia.ts";

// Rolling windows (not calendar-day boundaries), same pattern as
// trend.ts's periodFilter -- kept separate because this page needs
// sub-day granularity that StatsPeriod doesn't offer.
const PERIOD_HOURS: Record<TimelinePeriod, number | null> = {
	day: 24,
	week: 24 * 7,
	month: 24 * 30,
	year: 24 * 365,
	all: null,
};

function periodFilter(period: TimelinePeriod) {
	const hours = PERIOD_HOURS[period];
	if (hours === null) return sql`1=1`;
	return sql`datetime(${detections.Date} || ' ' || ${detections.Time}) >= datetime('now', ${`-${hours} hours`}, 'localtime')`;
}

export type TimelineRow = {
	comName: string;
	sciName: string;
	imageUrl: string | null;
	ebirdUrl: string;
	totalDetections: number;
	hourCounts: number[];
};

export type TimelineData = {
	rows: TimelineRow[];
	/**
	 * Whether the station has ever recorded anything, regardless of the selected
	 * period. An empty period is not the same as an empty station -- the page
	 * needs the difference so it only hides the period switcher when there is
	 * genuinely nothing to switch to.
	 */
	hasAnyDetections: boolean;
};

export const getTimelineData = createServerFn({ method: "GET" })
	.validator((period: TimelinePeriod) => period)
	.handler(async ({ data: period }): Promise<TimelineData> => {
		const rows = await db
			.select({
				comName: detections.Com_Name,
				sciName: detections.Sci_Name,
				hour: sql<string>`strftime('%H', ${detections.Time})`,
				count: sql<number>`count(*)`,
			})
			.from(detections)
			.where(periodFilter(period))
			.groupBy(
				detections.Com_Name,
				detections.Sci_Name,
				sql`strftime('%H', ${detections.Time})`,
			);

		const bySpecies = new Map<
			string,
			{ comName: string; sciName: string; hourCounts: number[] }
		>();
		for (const row of rows) {
			let entry = bySpecies.get(row.comName);
			if (!entry) {
				entry = {
					comName: row.comName,
					sciName: row.sciName,
					hourCounts: Array(24).fill(0),
				};
				bySpecies.set(row.comName, entry);
			}
			entry.hourCounts[Number(row.hour)] = row.count;
		}

		const withImages = await Promise.all(
			Array.from(bySpecies.values()).map(async (entry) => {
				const { imageUrl: wikiImageUrl } = await getSpeciesInfo(entry.comName);
				const totalDetections = entry.hourCounts.reduce((a, b) => a + b, 0);
				return {
					comName: entry.comName,
					sciName: entry.sciName,
					imageUrl: illustrationUrlFor(entry.sciName) ?? wikiImageUrl,
					ebirdUrl: ebirdUrlFor(entry.sciName, entry.comName),
					totalDetections,
					hourCounts: entry.hourCounts,
				};
			}),
		);

		// Anything in this period is proof enough; only an empty period pays for
		// the extra probe.
		const hasAnyDetections =
			withImages.length > 0 ||
			(await db.select({ one: sql<number>`1` }).from(detections).limit(1))
				.length > 0;

		return {
			rows: withImages.sort((a, b) => b.totalDetections - a.totalDetections),
			hasAnyDetections,
		};
	});
