import "@tanstack/react-start/server-only";

import path from "node:path";

// Matches BirdNET-Pi's RECS_DIR/EXTRACTED layout: BirdSongs lives as a
// sibling of the BirdNET-Pi checkout (web-ui/../../BirdSongs/Extracted),
// never inside the git repo itself. Point BIRDNET_EXTRACTED_DIR at the
// real path in production. Read lazily (not at module scope) so this
// works correctly under edge runtimes that inject env per-request too.
function extractedDir(): string {
	return path.resolve(
		process.env.BIRDNET_EXTRACTED_DIR ?? "../../BirdSongs/Extracted",
	);
}

const EXTENSION_MIME: Record<string, string> = {
	".mp3": "audio/mpeg",
	".wav": "audio/wav",
	".flac": "audio/flac",
	".ogg": "audio/ogg",
};

/**
 * Resolves a relative "By_Date/<date>/<species>/<file>" path against the
 * extracted-clips root, refusing anything that would escape it (path
 * traversal via `..` segments).
 */
export function resolveExtractedFile(relativePath: string): string | null {
	const root = extractedDir();
	const resolved = path.resolve(root, relativePath);
	if (resolved !== root && !resolved.startsWith(root + path.sep)) {
		return null;
	}
	return resolved;
}

export function mimeTypeFor(filePath: string): string {
	return (
		EXTENSION_MIME[path.extname(filePath).toLowerCase()] ??
		"application/octet-stream"
	);
}
