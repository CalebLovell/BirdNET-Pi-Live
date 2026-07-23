// URL-friendly identifier for a bird's detail page: the scientific name,
// lowercased with the genus/species words joined by underscores (e.g.
// "Cardinalis cardinalis" -> "cardinalis_cardinalis"). Kept separate from
// illustrations.ts's hyphenated slug, which instead has to match
// AvianVisitors' asset filenames.
export function sciNameToSlug(sciName: string): string {
	return sciName.trim().toLowerCase().replaceAll(/\s+/g, "_");
}

// Reverses sciNameToSlug for querying: since scientific names are plain
// space-separated words, lowercasing both sides makes this a safe,
// case-insensitive round trip without needing to reconstruct capitalization.
export function slugToSciNameQuery(slug: string): string {
	return slug.trim().toLowerCase().replaceAll("_", " ");
}
