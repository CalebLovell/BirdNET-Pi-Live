// Elapsed-time labels and the freshness thresholds that drive the Now page's
// hero card. Pure and isomorphic: the caller supplies `now`, so nothing here
// reads the clock on its own (see use-age-offset.ts for why that matters to SSR).

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Under this, a detection is treated as happening right now. */
export const SINGING_NOW_MS = 5 * MINUTE;
/** Under this, the bird is recently gone rather than absent. */
export const RECENTLY_HEARD_MS = HOUR;

export type Freshness = "singing" | "recent" | "quiet";

export function freshnessFor(elapsedMs: number): Freshness {
	if (elapsedMs < SINGING_NOW_MS) return "singing";
	if (elapsedMs < RECENTLY_HEARD_MS) return "recent";
	return "quiet";
}

function plural(value: number, unit: string): string {
	return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}

/**
 * A human elapsed-time label. Anything under ten seconds -- including a
 * negative elapsed time, which happens when the station's clock runs slightly
 * ahead of the viewer's -- reads as "just now" rather than exposing the skew.
 */
export function formatTimeAgo(elapsedMs: number): string {
	if (elapsedMs < 10 * SECOND) return "just now";
	if (elapsedMs < MINUTE)
		return plural(Math.floor(elapsedMs / SECOND), "second");
	if (elapsedMs < HOUR) return plural(Math.floor(elapsedMs / MINUTE), "minute");
	if (elapsedMs < DAY) return plural(Math.floor(elapsedMs / HOUR), "hour");
	return plural(Math.floor(elapsedMs / DAY), "day");
}

/** Clock time for a "YYYY-MM-DD HH:MM:SS" detection timestamp, e.g. "3:47 PM". */
export function formatClockTime(timestamp: string): string {
	const time = timestamp.slice(11);
	return new Date(`1970-01-01T${time}`).toLocaleTimeString([], {
		hour: "numeric",
		minute: "2-digit",
	});
}

/**
 * Same, to the second -- for the poll timestamp, where minute resolution would
 * leave a "live" indicator looking frozen between updates.
 */
export function formatClockTimeWithSeconds(timestamp: string): string {
	const time = timestamp.slice(11);
	return new Date(`1970-01-01T${time}`).toLocaleTimeString([], {
		timeStyle: "medium",
	});
}

export function hourLabel(hour: number): string {
	if (hour === 0) return "12 AM";
	if (hour < 12) return `${hour} AM`;
	if (hour === 12) return "12 PM";
	return `${hour - 12} PM`;
}
