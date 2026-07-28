// Shared shapes and day arithmetic for the two migration lists on the stats
// page. The filtering itself lives in SQL (lib/migration.ts); what is worth
// testing is the arithmetic that turns two dates into "17d", which is where
// month boundaries and daylight saving would otherwise bite.

/**
 * The one detection each row stands on -- the last one for a species that has
 * gone quiet, the first in-window one for an arrival. It is what gives these
 * rows a clip to play and a confidence to show, the same as a row on Recent
 * activity: the species is the subject, but a single detection is the evidence.
 */
export type MarkerDetection = {
	/** "YYYY-MM-DD HH:MM:SS", local, as stored. */
	detectedAt: string;
	/** Age measured on the server, so the first paint is already right. */
	ageMs: number;
	confidence: number | null;
	audioUrl: string | null;
};

/** A species whose regular presence has stopped: silent for QUIET_AFTER_DAYS+. */
export type QuietSpecies = MarkerDetection & {
	comName: string;
	sciName: string;
	/** Detections all-time. */
	count: number;
	/** ISO date of the most recent detection. */
	lastSeen: string;
	imageUrl: string | null;
};

/** A species detected in the recent window after an absence before it. */
export type ArrivalSpecies = MarkerDetection & {
	comName: string;
	sciName: string;
	/** Detections inside the recent window only, not all-time. */
	count: number;
	/** ISO date of the first detection inside the recent window. */
	firstSeen: string;
	imageUrl: string | null;
};

/**
 * Silence long enough to mean something. Two weeks outlasts a stretch of bad
 * weather or a microphone outage, so a species crossing it has more likely
 * moved on than simply gone unrecorded.
 */
export const QUIET_AFTER_DAYS = 14;

/** How far back "recently arrived" reaches, and the absence required before it. */
export const ARRIVAL_WINDOW_DAYS = 14;

/**
 * Days a species must have been detected on before its silence is worth
 * reporting. A single flyover -- or a single misidentification -- can leave
 * dozens of rows behind on one afternoon, so distinct days is the honest
 * measure of "regular" here, not detection count.
 */
export const RESIDENT_MIN_DAYS = 5;

/** How many rows each card shows. */
export const MIGRATION_LIST_LIMIT = 10;

const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

/** "Jul 11" -- the compact form the list rows use, falling back to the raw
 * value when the date is unparseable rather than printing "Invalid Date". */
export function shortDateLabel(isoDate: string): string {
	const parsed = new Date(`${isoDate}T00:00:00Z`);
	return Number.isNaN(parsed.getTime()) ? isoDate : SHORT_DATE.format(parsed);
}
