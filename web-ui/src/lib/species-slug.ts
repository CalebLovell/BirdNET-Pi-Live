// URL-friendly identifier for a bird's detail page, built from the common name
// so the address bar reads like the page ("Black-capped Chickadee" ->
// "black-capped-chickadee"). Apostrophes and periods are dropped rather than
// turned into separators, so "Anna's Hummingbird" stays "annas-hummingbird";
// every other run of punctuation or whitespace collapses to a single hyphen.
//
// Kept separate from illustrations.ts's slug, which is built from the
// scientific name to match AvianVisitors' asset filenames.
export function comNameToSlug(comName: string): string {
	return comName
		.trim()
		.toLowerCase()
		.replaceAll(/['’.]/g, "")
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replace(/^-+/, "")
		.replace(/-+$/, "");
}
