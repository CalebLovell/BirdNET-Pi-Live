import { comNameToSlug } from "~/lib/species-slug.ts";

/** One entry of the model's label catalog. Structurally the same shape as
 * `InstalledSpecies`, kept here so this module stays free of server imports
 * and can be tested without any model files on disk. */
export type CatalogSpecies = { sciName: string; comName: string };

/**
 * The bird a slug names, whether or not this station has ever heard it.
 *
 * Slugging is lossy -- apostrophes and periods are dropped outright -- so the
 * catalog is slugged and matched forwards, exactly as `resolveComName` does
 * against the detections table. Reversing a slug is not possible.
 */
export function findCatalogSpeciesBySlug(
	slug: string,
	catalog: readonly CatalogSpecies[],
): CatalogSpecies | null {
	if (slug === "") return null;
	return catalog.find((item) => comNameToSlug(item.comName) === slug) ?? null;
}
