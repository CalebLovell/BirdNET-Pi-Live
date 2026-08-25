// Today's story: the rules that decide whether the last 24 hours are worth
// remarking on, and the sentences they produce. Pure on purpose -- the SQL that
// gathers the evidence lives in lib/story.ts, so the judgement itself can be
// tested against hand-written facts rather than a seeded database.
//
// The whole point of the component is the notability gate: it speaks only when
// something deviates from this station's own baseline. A story that finds
// something to say every day is wallpaper, and stops being read.

import { QUIET_AFTER_DAYS } from "~/lib/migration-data.ts";

/** Silence long enough that coming back is news. The same fortnight the
    timeline's quiet list uses, so the two pages never disagree about "away". */
export const RETURN_AFTER_DAYS = QUIET_AFTER_DAYS;

/** Records ever, at or below which a species is still a rare visitor here. */
export const RARE_LIFETIME_MAX = 5;

/** Days out of the previous fortnight a species must have been heard on
    before its silence counts as breaking a routine rather than just a gap. */
export const ROUTINE_MIN_DAYS = 10;

/** How long such a regular must have been silent before it is worth saying. */
export const ROUTINE_SILENT_DAYS = 2;

/**
 * Detections per day below which the volume comparison stays quiet. A station
 * averaging a handful of detections swings by hundreds of percent on noise
 * alone, and "activity is 200% up" on three detections is not a story.
 */
export const VOLUME_BASELINE_MIN = 20;

/** How far from the fortnight average counts as busy, and as quiet. */
export const BUSY_RATIO = 1.3;
export const QUIET_RATIO = 0.7;

/** Below this the station has too little history to call a day normal at all. */
export const LEARNING_BASELINE = 5;

/** Species named per line. Beyond this they are counted, not listed. */
export const STORY_SPECIES_LIMIT = 3;

export type StorySpecies = {
	comName: string;
	sciName: string;
	speciesSlug: string;
	imageUrl: string | null;
};

/** A species as a story names it: the bird, plus why it is in this line. */
export type StoryMention = StorySpecies & {
	/** "23 days away", "4 records ever" -- null when the headline says it all. */
	note: string | null;
};

export type StoryTone =
	| "new"
	| "return"
	| "rare"
	| "routine"
	| "busy"
	| "quiet"
	| "calm"
	| "learning";

export type StoryLine = {
	/** Which rule fired. The card maps it to an icon; nothing else reads it. */
	tone: StoryTone;
	headline: string;
	/** The sentence beneath, where the headline alone would be cryptic. */
	detail: string | null;
	species: StoryMention[];
	/** Qualifying species past the ones listed, so the count stays honest. */
	moreCount: number;
};

/**
 * Everything the rules need, already gathered. Each list arrives ordered by
 * how strongly it qualifies, because only the first few are ever shown.
 */
export type StoryFacts = {
	/** Heard in the window, never heard before it. Most detections first. */
	newSpecies: StorySpecies[];
	/** Heard in the window after a long silence. Longest silence first. */
	returning: (StorySpecies & { daysAway: number })[];
	/** Heard in the window and barely ever otherwise. Fewest records first. */
	rare: (StorySpecies & { lifetimeCount: number })[];
	/** Regulars absent from the window. Most regular first. */
	breakingRoutine: (StorySpecies & { daysSilent: number })[];
	/** Detections inside the window. */
	windowCount: number;
	/** Mean detections per 24 hours over the fortnight before the window. */
	baseline: number;
};

function plural(count: number, one: string, many: string): string {
	return count === 1 ? one : many;
}

/**
 * The first STORY_SPECIES_LIMIT entries as mentions, plus however many were
 * left over. `note` is what earned each bird its place in the line.
 */
function mention<Row extends StorySpecies>(
	rows: Row[],
	noteFor: (row: Row) => string | null,
): Pick<StoryLine, "species" | "moreCount"> {
	return {
		species: rows.slice(0, STORY_SPECIES_LIMIT).map((row) => ({
			comName: row.comName,
			sciName: row.sciName,
			speciesSlug: row.speciesSlug,
			imageUrl: row.imageUrl,
			note: noteFor(row),
		})),
		moreCount: Math.max(0, rows.length - STORY_SPECIES_LIMIT),
	};
}

/**
 * The story, in the order it reads best: arrivals first (a new bird is the
 * biggest thing that can happen here), then absences, then the day's volume.
 * Never empty -- when no rule fires, one of the two closing lines says so
 * plainly rather than leaving the card blank, because "nothing unusual" is
 * itself the answer to the question the card is asking.
 */
export function buildStory(facts: StoryFacts): StoryLine[] {
	const lines: StoryLine[] = [];

	if (facts.newSpecies.length > 0) {
		const total = facts.newSpecies.length;
		lines.push({
			tone: "new",
			headline:
				total === 1
					? "A brand new species for your station"
					: `${total} new species for your station`,
			detail: null,
			...mention(facts.newSpecies, () => null),
		});
	}

	if (facts.returning.length > 0) {
		lines.push({
			tone: "return",
			headline: "Back after time away",
			detail: null,
			...mention(facts.returning, (row) => `${row.daysAway} days away`),
		});
	}

	if (facts.rare.length > 0) {
		lines.push({
			tone: "rare",
			headline: plural(facts.rare.length, "Rare visitor", "Rare visitors"),
			detail: "Barely ever heard here — worth a listen in Review.",
			...mention(
				facts.rare,
				(row) =>
					`${row.lifetimeCount} ${plural(row.lifetimeCount, "record", "records")} ever`,
			),
		});
	}

	if (facts.breakingRoutine.length > 0) {
		lines.push({
			tone: "routine",
			headline: "Breaking routine",
			detail: "Heard most days lately, but silent through the last 24 hours.",
			...mention(
				facts.breakingRoutine,
				(row) => `silent ${row.daysSilent} days`,
			),
		});
	}

	// Volume speaks last and only when the baseline is worth comparing against,
	// so a quiet station's normal variation never gets dressed up as a trend.
	if (facts.baseline >= VOLUME_BASELINE_MIN) {
		const ratio = facts.windowCount / facts.baseline;
		if (ratio >= BUSY_RATIO) {
			lines.push({
				tone: "busy",
				headline: "A busy day",
				detail: `Activity is ${Math.round((ratio - 1) * 100)}% above your two-week average.`,
				species: [],
				moreCount: 0,
			});
		} else if (ratio <= QUIET_RATIO) {
			lines.push({
				tone: "quiet",
				headline: "Quieter than usual",
				detail: `Activity is ${Math.round((1 - ratio) * 100)}% below your two-week average.`,
				species: [],
				moreCount: 0,
			});
		}
	}

	if (lines.length > 0) return lines;

	return [
		facts.baseline < LEARNING_BASELINE
			? {
					tone: "learning",
					headline: "Still settling in",
					detail:
						"Your station is still learning what a normal day sounds like here.",
					species: [],
					moreCount: 0,
				}
			: {
					tone: "calm",
					headline: "A typical day",
					detail: "Steady activity, and nothing unusual to report.",
					species: [],
					moreCount: 0,
				},
	];
}
