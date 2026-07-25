import { Link } from "@tanstack/react-router";

import { ConfidencePill } from "~/components/confidence-pill.tsx";
import { RecordingButton } from "~/components/recording-button.tsx";
import { LIST_ROW, SpeciesThumbnail } from "~/components/species-rank-row.tsx";
import type { RecentDetection } from "~/lib/now.ts";
import { formatClockTime, formatTimeAgo } from "~/lib/time-ago.ts";

export function RecentLogCard({
	recent,
	offsetMs,
	freshKeys,
}: {
	recent: RecentDetection[];
	offsetMs: number;
	freshKeys: Set<string>;
}) {
	return (
		<section
			aria-label="Recent detections"
			className="feature-card flex flex-col rounded-md p-4 sm:p-6"
		>
			<div className="island-kicker">Recent activity</div>

			{recent.length === 0 ? (
				<p className="mt-4 text-muted-foreground text-sm">
					Nothing detected in the last 24 hours.
				</p>
			) : (
				<ul className="mt-4 space-y-1">
					{recent.map((detection) => (
						<li
							key={detection.key}
							className={
								freshKeys.has(detection.key) ? `${LIST_ROW} flash-in` : LIST_ROW
							}
						>
							<SpeciesThumbnail
								imageUrl={detection.imageUrl}
								comName={detection.comName}
							/>

							<div className="min-w-0 flex-1">
								<Link
									to="/species/$sciName"
									params={{ sciName: detection.speciesSlug }}
									className="block truncate font-medium no-underline hover:underline"
								>
									{detection.comName}
								</Link>
								<div className="truncate text-[var(--bark)] text-xs italic">
									{detection.sciName}
								</div>
							</div>

							<div className="shrink-0 text-right">
								<time
									dateTime={detection.detectedAt.replace(" ", "T")}
									className="tabular-data block text-sm"
								>
									{formatClockTime(detection.detectedAt)}
								</time>
								<div className="text-muted-foreground text-xs">
									{formatTimeAgo(detection.ageMs + offsetMs)}
								</div>
							</div>

							<ConfidencePill
								confidence={detection.confidence}
								className="shrink-0"
							/>
							<RecordingButton audioUrl={detection.audioUrl} />
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
