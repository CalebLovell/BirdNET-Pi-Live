import { createServerFn } from "@tanstack/react-start";

import { type DayPageResult, loadDayPage } from "~/lib/day.ts";
import { loadAllTimeStats, type StatsData } from "~/lib/stats.ts";
import type { TrendPoint } from "~/lib/stats-data.ts";
import {
	loadTimelineData,
	loadTimelineNav,
	type TimelineNav,
	type TimelineRow,
} from "~/lib/timeline.ts";
import type { TimelinePeriod } from "~/lib/timeline-periods.ts";
import { type TimelineAnchor, windowFor } from "~/lib/timeline-window.ts";
import { getMonthlyTrend } from "~/lib/trend.ts";

export type TimelinePageRequest = {
	period: TimelinePeriod;
	/** Ignored when the period is "all". */
	anchor: TimelineAnchor;
};

/**
 * What a period is actually about, beyond the species-by-hour grid every one
 * of them shares.
 *
 * A single day is a review of that day -- when it opened and closed, how it
 * measured against a typical one, which clips came out best -- so it loads a
 * different shape entirely rather than a one-day slice of the grid. A week,
 * month or year is a window over the rhythm, with the year adding the
 * month-by-month shape a shorter window cannot show. All time is where the
 * rankings and the migration lists live: each needs the station's whole
 * history as its baseline, and says nothing inside a single week.
 */
export type TimelineBody =
	| { kind: "day"; result: DayPageResult }
	| { kind: "window"; rows: TimelineRow[]; trend: TrendPoint[] | null }
	| { kind: "all"; rows: TimelineRow[]; stats: StatsData };

export type TimelinePageData = TimelineNav & { body: TimelineBody };

export const getTimelinePage = createServerFn({ method: "GET" })
	.validator((request: TimelinePageRequest) => request)
	.handler(async ({ data: { period, anchor } }): Promise<TimelinePageData> => {
		// The day view draws the same toolbar as every other period, so it still
		// needs to know where it sits in the station's history -- but its body
		// comes from the day review, not the grid, so the rows query is skipped
		// rather than run and thrown away.
		if (period === "day") {
			// Judged before the window is built, not alongside it: a date the
			// calendar cannot read has no window to resolve, and asking for one
			// would throw where the page wants to explain itself instead.
			const result = await loadDayPage(anchor);
			const nav = await loadTimelineNav(
				"day",
				result.status === "ok" ? windowFor("day", anchor) : null,
			);
			return { ...nav, body: { kind: "day", result } };
		}

		if (period === "all") {
			const [{ rows, ...nav }, stats] = await Promise.all([
				loadTimelineData({ period, anchor }),
				loadAllTimeStats(),
			]);
			return { ...nav, body: { kind: "all", rows, stats } };
		}

		const { rows, ...nav } = await loadTimelineData({ period, anchor });
		// Twelve months only mean something once the window is a year wide. The
		// anchor is the year itself under that period, so the toolbar's picker is
		// the chart's year selector -- there is no second control for it.
		const trend =
			period === "year" ? await getMonthlyTrend(Number(anchor)) : null;

		return { ...nav, body: { kind: "window", rows, trend } };
	});
