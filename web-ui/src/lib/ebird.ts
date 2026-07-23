import ebirdCodes from "#/lib/ebird-codes.json";

// Scientific name -> eBird's stable 6-char species code, lifted from
// BirdNET-Pi's own scripts/ebird.php lookup table (same source data the
// Twarner491/AvianVisitors fork uses for its atlas view's eBird links).
// eBird's species pages are public at https://ebird.org/species/<code>,
// unlike their search/list pages which redirect anonymous requests to a
// login wall -- so a direct code-based link sidesteps that entirely.
const CODES: Record<string, string> = ebirdCodes;

export function ebirdUrlFor(sciName: string, commonName: string): string {
	const code = CODES[sciName];
	if (code) return `https://ebird.org/species/${code}`;
	// No cataloged code (rare) -- fall back to a scoped web search.
	return `https://www.google.com/search?q=${encodeURIComponent(`${commonName} ebird`)}`;
}
