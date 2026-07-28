import { commonNameSafe } from "~/lib/audio.ts";

/**
 * A species with fewer lifetime detections than this is worth a second listen;
 * anything the station hears routinely is not. An absolute count rather than a
 * share of the station's traffic, so the queue means the same thing on day one
 * as it does after five years of recording.
 */
export const RARE_SPECIES_MAX = 10;

export type ReviewSearch = { limit: number };
export type SpeciesOption = { sciName: string; comName: string };

export function normalizeReviewSearch(
	input: Record<string, unknown>,
): ReviewSearch {
	const limit =
		typeof input.limit === "number" &&
		Number.isSafeInteger(input.limit) &&
		input.limit >= 20 &&
		input.limit % 20 === 0
			? input.limit
			: 20;
	return { limit };
}

export function parseSpeciesCatalog(text: string): SpeciesOption[] {
	const parsed = JSON.parse(text) as Record<string, unknown>;
	return Object.entries(parsed)
		.filter(
			(entry): entry is [string, string] =>
				entry[0].trim().length > 0 &&
				typeof entry[1] === "string" &&
				entry[1].trim().length > 0,
		)
		.map(([sciName, comName]) => ({ sciName, comName }))
		.sort((a, b) => a.comName.localeCompare(b.comName));
}

export function recategorizedFileName(
	fileName: string,
	oldCommonName: string,
	newCommonName: string,
): string | null {
	const prefix = `${commonNameSafe(oldCommonName)}-`;
	return fileName.startsWith(prefix)
		? `${commonNameSafe(newCommonName)}-${fileName.slice(prefix.length)}`
		: null;
}
