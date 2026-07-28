import { commonNameSafe } from "~/lib/audio.ts";

export const REVIEW_QUEUES = ["rare", "low-confidence"] as const;
export type ReviewQueue = (typeof REVIEW_QUEUES)[number];
export type ReviewSearch = { queue: ReviewQueue; limit: number };
export type SpeciesOption = { sciName: string; comName: string };

export function normalizeReviewSearch(
	input: Record<string, unknown>,
): ReviewSearch {
	const queue = REVIEW_QUEUES.includes(input.queue as ReviewQueue)
		? (input.queue as ReviewQueue)
		: "rare";
	const limit =
		typeof input.limit === "number" &&
		input.limit >= 20 &&
		input.limit <= 200 &&
		input.limit % 20 === 0
			? input.limit
			: 20;
	return { queue, limit };
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
