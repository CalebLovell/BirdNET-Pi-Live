import { localTimestamp } from "~/lib/visits.ts";

/** A calendar day identifier, "YYYY-MM-DD". */
export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isDayId(value: string): boolean {
	if (!DAY_PATTERN.test(value)) return false;
	const parsed = new Date(`${value}T00:00:00`);
	if (Number.isNaN(parsed.getTime())) return false;
	// A Date rolls an impossible day forward rather than refusing it -- the 30th
	// of February parses happily as the 1st or 2nd of March. Comparing the
	// parsed date back to the input is what catches that.
	return dayIdFor(parsed) === value;
}

export function dayIdFor(date: Date): string {
	return localTimestamp(date).slice(0, 10);
}
