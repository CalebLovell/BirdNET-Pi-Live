import "@tanstack/react-start/server-only";

import path from "node:path";

import { commonNameSafe } from "~/lib/audio.ts";

export type DetectionClipIdentity = {
	date: string;
	commonName: string;
	fileName: string;
};

function isSafePathSegment(value: string): boolean {
	return (
		value.length > 0 &&
		value !== "." &&
		value !== ".." &&
		!value.includes("/") &&
		!value.includes("\\")
	);
}

export function resolveDetectionClipPath(
	root: string,
	clip: DetectionClipIdentity,
): string | null {
	const resolvedRoot = path.resolve(root);
	const commonName = commonNameSafe(clip.commonName);
	if (![clip.date, commonName, clip.fileName].every(isSafePathSegment)) {
		return null;
	}
	const candidate = path.resolve(
		resolvedRoot,
		"By_Date",
		clip.date,
		commonName,
		clip.fileName,
	);

	return candidate.startsWith(`${resolvedRoot}${path.sep}`) ? candidate : null;
}
