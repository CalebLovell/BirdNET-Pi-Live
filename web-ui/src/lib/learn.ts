import { existsSync } from "node:fs";

import { createServerFn } from "@tanstack/react-start";

import { sqlite } from "~/db/index.ts";
import { extractedDir } from "~/lib/audio.server.ts";
import { resolveDetectionClipPath } from "~/lib/detection-file-path.server.ts";
import { illustrationUrlFor } from "~/lib/illustrations.ts";
import {
	FREQUENT_SPECIES_THRESHOLD,
	type LearnPool,
} from "~/lib/learn-pools.ts";
import {
	buildRound,
	type LearnRound,
	type PoolSpecies,
} from "~/lib/learn-round.ts";
import { sciNameToSlug } from "~/lib/species-slug.ts";
import { getSpeciesInfo } from "~/lib/wikipedia.ts";

// A weak detection is usually a smear of wind or traffic that happens to score
// as a bird -- unfair to quiz someone on. Only clips the analyzer felt good
// about become questions.
const MINIMUM_CLIP_CONFIDENCE = 0.65;

// Taken per species, not per pool, so a bird heard twice this week is as likely
// to come up as the crow that never shuts up. Newest first, because BirdNET-Pi's
// cleanup job trims old audio: a species' recent detections are the ones whose
// files are still on disk. Which of the survivors a question uses is then
// chosen at random, so a round doesn't replay the same clip every time.
const CLIPS_PER_SPECIES = 30;

const POOL_HOURS: Record<LearnPool, number | null> = {
	today: 24,
	week: 24 * 7,
	frequent: null,
	all: null,
};

type ClipRow = {
	date: string;
	comName: string;
	sciName: string;
	fileName: string;
	confidence: number | null;
	detectedAt: string;
};

/**
 * One window-function query beats a per-species round trip here: it takes an
 * even slice of every species in the pool in a single pass. Drizzle's
 * sqlite-proxy driver hands back positional rows, which makes a raw statement on
 * the shared handle the clearer way to express this particular shape.
 */
function recentClipsPerSpecies(pool: LearnPool): ClipRow[] {
	const hours = POOL_HOURS[pool];
	const conditions = ["Confidence >= ?"];
	const params: (string | number)[] = [MINIMUM_CLIP_CONFIDENCE];

	if (hours !== null) {
		conditions.push(
			"datetime(Date || ' ' || Time) >= datetime('now', ?, 'localtime')",
		);
		params.push(`-${hours} hours`);
	}
	if (pool === "frequent") {
		conditions.push(
			"Com_Name IN (SELECT Com_Name FROM detections GROUP BY Com_Name HAVING COUNT(*) >= ?)",
		);
		params.push(FREQUENT_SPECIES_THRESHOLD);
	}

	const statement = sqlite.prepare(`
		SELECT date, comName, sciName, fileName, confidence, detectedAt
		FROM (
			SELECT
				Date AS date,
				Com_Name AS comName,
				Sci_Name AS sciName,
				File_Name AS fileName,
				Confidence AS confidence,
				Date || ' ' || Time AS detectedAt,
				ROW_NUMBER() OVER (PARTITION BY Com_Name ORDER BY Date DESC, Time DESC) AS rn
			FROM detections
			WHERE ${conditions.join(" AND ")}
		)
		WHERE rn <= ?
	`);

	return statement.all(...params, CLIPS_PER_SPECIES) as ClipRow[];
}

// A clip whose file has been cleaned off disk would leave a question with
// nothing to play, so it never makes it into the pool. Only the sampled rows
// are checked, which keeps this to a few hundred stat calls at most.
function clipFileExists(row: ClipRow): boolean {
	const path = resolveDetectionClipPath(extractedDir(), {
		date: row.date,
		commonName: row.comName,
		fileName: row.fileName,
	});
	return path !== null && existsSync(path);
}

function groupIntoSpecies(rows: ClipRow[]): PoolSpecies[] {
	const bySpecies = new Map<string, PoolSpecies>();

	for (const row of rows) {
		let species = bySpecies.get(row.comName);
		if (!species) {
			species = {
				comName: row.comName,
				sciName: row.sciName,
				speciesSlug: sciNameToSlug(row.sciName),
				// Only the bundled illustrations here -- Wikipedia lookups are network
				// calls, so they wait until we know which species the round uses.
				imageUrl: illustrationUrlFor(row.sciName),
				clips: [],
			};
			bySpecies.set(row.comName, species);
		}
		species.clips.push({
			date: row.date,
			fileName: row.fileName,
			detectedAt: row.detectedAt,
			confidence: row.confidence,
		});
	}

	return [...bySpecies.values()];
}

/** Fills in Wikipedia thumbnails for the species this round actually shows. */
async function addMissingImages(round: LearnRound): Promise<LearnRound> {
	const needed = new Map<string, string>();
	for (const question of round.questions) {
		for (const choice of question.choices) {
			if (!choice.imageUrl) needed.set(choice.sciName, choice.comName);
		}
	}

	const resolved = new Map(
		await Promise.all(
			[...needed].map(
				async ([sciName, comName]) =>
					[sciName, (await getSpeciesInfo(comName)).imageUrl] as const,
			),
		),
	);

	return {
		...round,
		questions: round.questions.map((question) => ({
			...question,
			choices: question.choices.map((choice) => ({
				...choice,
				imageUrl: choice.imageUrl ?? resolved.get(choice.sciName) ?? null,
			})),
		})),
	};
}

export const getLearnRound = createServerFn({ method: "GET" })
	.validator((pool: LearnPool) => pool)
	.handler(async ({ data: pool }): Promise<LearnRound> => {
		const rows = recentClipsPerSpecies(pool).filter(clipFileExists);
		return addMissingImages(buildRound(groupIntoSpecies(rows)));
	});
