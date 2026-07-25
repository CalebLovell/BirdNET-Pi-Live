import type { CSSProperties } from "react";

export function formatConfidence(confidence: number | null): string {
	return confidence != null ? `${Math.round(confidence * 100)}%` : "—";
}

// Three tiers rather than a gradient, so a glance down a column of pills sorts
// detections into "trust it", "probably", and "worth listening to yourself".
export function confidenceStyle(confidence: number): CSSProperties {
	if (confidence >= 0.9) {
		return {
			backgroundColor:
				"color-mix(in oklab, var(--moss) 12%, var(--paper-raised))",
			color: "var(--moss)",
		};
	}

	if (confidence >= 0.75) {
		return {
			backgroundColor:
				"color-mix(in oklab, var(--sand) 20%, var(--paper-raised))",
			color: "var(--bark)",
		};
	}

	return {
		backgroundColor:
			"color-mix(in oklab, var(--sage) 32%, var(--paper-raised))",
		color: "var(--ink)",
	};
}
