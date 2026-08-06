import { isDayId } from "~/lib/day.ts";

/**
 * What a `/day/$date` parameter turned out to be.
 *
 * Only `in-range` is a page. The other three are dead ends: the route renders
 * the standard not-found card for each, rather than a confident day page for a
 * day that never happened.
 */
export type DayVerdict = "malformed" | "future" | "before-station" | "in-range";

/**
 * All three dates are "YYYY-MM-DD", which sorts correctly as a string -- no
 * Date objects and therefore no timezone to get wrong.
 *
 * A day between the station's last recording and today stays `in-range`: the
 * station was simply quiet, which is an empty state and not a broken one.
 * `firstRecorded` is null on a station that has never recorded anything, and
 * then nothing in the past can be out of range.
 */
export function classifyDay(
	date: string,
	today: string,
	firstRecorded: string | null,
): DayVerdict {
	if (!isDayId(date)) return "malformed";
	if (date > today) return "future";
	if (firstRecorded !== null && date < firstRecorded) return "before-station";
	return "in-range";
}
