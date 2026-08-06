import { Link } from "@tanstack/react-router";
import { Info } from "lucide-react";

import { ConfidencePill } from "~/components/confidence-pill.tsx";
import { EmptyNote } from "~/components/empty-state.tsx";
import { RecordingButton } from "~/components/recording-button.tsx";
import { LIST_ROW, SpeciesThumbnail } from "~/components/species-row.tsx";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip.tsx";
import { comNameToSlug } from "~/lib/species-slug.ts";
import { formatTimeAgo } from "~/lib/time-ago.ts";

export type SpeciesActivityItem = {
	comName: string;
	sciName: string;
	imageUrl: string | null;
	/** The marker detection's timestamp, "YYYY-MM-DD HH:MM:SS" local. */
	detectedAt: string;
	/** Age of the marker detection, measured on the server. */
	ageMs: number;
	/** The top line of the time column, e.g. "Jul 11". */
	timeLabel: string;
	confidence: number | null;
	audioUrl: string | null;
};

/**
 * A species list keyed on *when* something happened rather than how often --
 * the quiet and arrival cards on the stats page.
 *
 * The row is Recent activity's row: name over scientific name, a two-line time
 * column, a confidence pill, and the clip. Each row stands on one marker
 * detection (the last one heard, or the first of a new arrival), which is what
 * gives an aggregate list something concrete to play and score.
 *
 * The top line of the time column is a date rather than Recent activity's clock
 * time: these detections are days or weeks old, where "7:36 PM" alone says
 * nothing. Everything below it is identical.
 */
export function SpeciesActivityList({
	title,
	description,
	species,
	emptyMessage,
	className = "",
}: {
	title: string;
	/** The tooltip body explaining how the list is built. */
	description: string;
	species: SpeciesActivityItem[];
	emptyMessage: string;
	className?: string;
}) {
	return (
		<section
			aria-label={title}
			className={`feature-card flex flex-col rounded-md p-4 ${className}`}
		>
			<div className="flex items-center gap-1.5">
				<div className="island-kicker">{title}</div>
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							aria-label={`About ${title}`}
							className="inline-flex items-center text-muted-foreground transition-colors hover:text-[var(--moss)]"
						>
							<Info className="size-3.5" />
						</button>
					</TooltipTrigger>
					<TooltipContent className="max-w-56">{description}</TooltipContent>
				</Tooltip>
			</div>

			{species.length === 0 ? (
				<EmptyNote>{emptyMessage}</EmptyNote>
			) : (
				<ol className="mt-4 space-y-1">
					{species.map((item) => (
						<li key={item.comName} className={LIST_ROW}>
							<SpeciesThumbnail
								imageUrl={item.imageUrl}
								comName={item.comName}
							/>

							<div className="min-w-0 flex-1">
								<Link
									to="/species/$comName"
									params={{ comName: comNameToSlug(item.comName) }}
									className="block truncate font-medium no-underline hover:underline"
								>
									{item.comName}
								</Link>
								<div className="truncate text-[var(--bark)] text-xs italic">
									{item.sciName}
								</div>
							</div>

							<div className="shrink-0 text-right">
								<time
									dateTime={item.detectedAt.replace(" ", "T")}
									className="tabular-data block text-sm"
								>
									{item.timeLabel}
								</time>
								<div className="text-muted-foreground text-xs">
									{formatTimeAgo(item.ageMs)}
								</div>
							</div>

							<ConfidencePill
								confidence={item.confidence}
								className="shrink-0"
							/>
							<RecordingButton audioUrl={item.audioUrl} />
						</li>
					))}
				</ol>
			)}
		</section>
	);
}
