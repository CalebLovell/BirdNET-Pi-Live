import { z } from "zod";

export const SPECIES_LIST_LIMIT = 7_000;
export const UNRESOLVED_REMOVAL_LIMIT = 1_000;

export type SpeciesPolicy = "automatic" | "always" | "never";
export type SpeciesListName = "custom" | "excluded" | "whitelisted";

export type SpeciesHistorySummary = {
	detections: number;
	maxConfidence: number | null;
	lastSeen: string | null;
	recordings: number;
};

export type SpeciesControlRow = {
	sciName: string;
	comName: string;
	custom: boolean;
	excluded: boolean;
	whitelisted: boolean;
	history: SpeciesHistorySummary;
};

export type UnresolvedSpeciesLists = Record<SpeciesListName, string[]>;

export type SpeciesControlPageData = {
	revision: string;
	rows: SpeciesControlRow[];
	unresolved: UnresolvedSpeciesLists;
	customMode: boolean;
	listFiles: Record<SpeciesListName, boolean>;
};

export type HistoryDeletePreview = {
	sciName: string;
	comName: string;
	rows: number;
	recordings: number;
	assets: number;
};

export type HistoryDeleteResult = {
	deletedRows: number;
	deletedAssets: number;
	missingAssets: number;
	failedAssets: number;
};

const scientificNamePattern = /^[\p{L}][\p{L}.'-]*(?: [\p{L}][\p{L}.'-]*)+$/u;

export const scientificNameSchema = z
	.string()
	.min(3)
	.max(160)
	.refine((value) => value === value.trim(), "Must not contain outer spaces")
	.regex(scientificNamePattern, "Must be a scientific name");

const revisionSchema = z.string().min(1).max(128);
const knownListSchema = z.array(scientificNameSchema).max(SPECIES_LIST_LIMIT);
const unresolvedRemovalSchema = z
	.object({
		list: z.enum(["custom", "excluded", "whitelisted"]),
		raw: z
			.string()
			.min(1)
			.max(512)
			.refine(
				(value) => value === value.trim(),
				"Must not contain outer spaces",
			),
	})
	.strict();

export const speciesControlSaveSchema = z
	.object({
		revision: revisionSchema,
		custom: knownListSchema,
		excluded: knownListSchema,
		whitelisted: knownListSchema,
		removeUnresolved: z
			.array(unresolvedRemovalSchema)
			.max(UNRESOLVED_REMOVAL_LIMIT),
	})
	.strict();

export const speciesControlDeletePreviewSchema = z
	.object({ sciName: scientificNameSchema })
	.strict();

export const speciesControlDeleteSchema = z
	.object({
		sciName: scientificNameSchema,
		expectedRows: z.number().int().nonnegative().max(10_000_000),
	})
	.strict();

export type SpeciesControlSaveInput = z.infer<typeof speciesControlSaveSchema>;
export type SpeciesControlDeleteInput = z.infer<
	typeof speciesControlDeleteSchema
>;

export function applySpeciesPolicy(
	current: { custom: boolean; policy: SpeciesPolicy },
	policy: SpeciesPolicy,
	customMode: boolean,
): { custom: boolean; policy: SpeciesPolicy } {
	if (policy === "never") return { custom: false, policy };
	if (policy === "always")
		return { custom: customMode || current.custom, policy };
	return { custom: current.custom, policy };
}

function stableUnique(values: unknown): string[] {
	if (!Array.isArray(values)) return [];
	const seen = new Set<string>();
	const result: string[] = [];
	for (const value of values) {
		if (typeof value !== "string") continue;
		const normalized = value.trim();
		if (seen.has(normalized)) continue;
		seen.add(normalized);
		result.push(normalized);
	}
	return result;
}

export function normalizeSpeciesControlSave(
	input: Record<string, unknown>,
): SpeciesControlSaveInput {
	const removals = Array.isArray(input.removeUnresolved)
		? input.removeUnresolved
				.map((entry) => {
					if (!entry || typeof entry !== "object") return null;
					const candidate = entry as Record<string, unknown>;
					return {
						list: candidate.list,
						raw:
							typeof candidate.raw === "string"
								? candidate.raw.trim()
								: candidate.raw,
					};
				})
				.filter((entry) => entry !== null)
		: [];
	const seenRemovals = new Set<string>();
	const uniqueRemovals = removals.filter((entry) => {
		const key = `${String(entry.list)}\0${String(entry.raw)}`;
		if (seenRemovals.has(key)) return false;
		seenRemovals.add(key);
		return true;
	});

	return speciesControlSaveSchema.parse({
		revision:
			typeof input.revision === "string"
				? input.revision.trim()
				: input.revision,
		custom: stableUnique(input.custom),
		excluded: stableUnique(input.excluded),
		whitelisted: stableUnique(input.whitelisted),
		removeUnresolved: uniqueRemovals,
	});
}
