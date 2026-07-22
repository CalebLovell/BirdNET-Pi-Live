// Pure, isomorphic string helpers -- safe to import from client-rendered
// components. Filesystem-touching code (EXTRACTED_DIR, resolveExtractedFile,
// mimeTypeFor) lives in audio.server.ts, which is import-protected so it can
// never end up in the client bundle.

export function commonNameSafe(commonName: string): string {
	return commonName.replaceAll("'", "").replaceAll(" ", "_");
}

// The server route only supports 2 chained dynamic segments (3+ breaks route
// registration in the installed TanStack Start version), so species and
// filename travel as one segment. A literal "." anywhere in a path segment
// (e.g. the ".wav" extension) makes Nitro's dev server treat the request as
// a static-asset lookup before it ever reaches a dynamic route -- and
// percent-encoding it doesn't survive, since browsers normalize %2E back to
// "." before sending the request. Base64url has no dots at all, so it
// sidesteps the problem entirely instead of fighting URL normalization.
const SEGMENT_SEPARATOR = "::";

function base64UrlEncode(value: string): string {
	return btoa(value)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

function base64UrlDecode(value: string): string {
	const padded = value.replaceAll("-", "+").replaceAll("_", "/");
	const padding =
		padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
	return atob(padded + padding);
}

/** Builds the /api/audio URL for a given detection's extracted clip. */
export function audioUrlFor(
	date: string,
	commonName: string,
	fileName: string,
): string {
	const speciesAndFile = `${commonNameSafe(commonName)}${SEGMENT_SEPARATOR}${fileName}`;
	return `/api/audio/${encodeURIComponent(date)}/${base64UrlEncode(speciesAndFile)}`;
}

export function splitSpeciesAndFile(
	encoded: string,
): [species: string, file: string] {
	const [species, file] = base64UrlDecode(encoded).split(SEGMENT_SEPARATOR);
	return [species ?? "", file ?? ""];
}
