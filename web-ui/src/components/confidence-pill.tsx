import { confidenceStyle, formatConfidence } from "~/lib/confidence.ts";

export function ConfidencePill({
	confidence,
	className = "",
}: {
	confidence: number | null;
	className?: string;
}) {
	if (confidence == null) return null;

	return (
		<span
			className={`tabular-data rounded-full px-2 py-1 font-semibold text-xs ${className}`}
			style={confidenceStyle(confidence)}
		>
			{formatConfidence(confidence)}
		</span>
	);
}
