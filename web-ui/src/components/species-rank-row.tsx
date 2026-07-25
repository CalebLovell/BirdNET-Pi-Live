import { Link } from "@tanstack/react-router";
import { Bird } from "lucide-react";

import { rankingBarPercent } from "~/lib/stats-data.ts";

/**
 * The shared row shell for the ranked/recent species lists. Top detections and
 * Recent activity sit side by side on the now page, so their rows share one
 * height: the taller card (the one with progress bars) sets it, and the shorter
 * one pads out to match rather than drifting out of alignment down the column.
 */
export const LIST_ROW =
	"flex min-h-18 items-center gap-3 rounded-md px-3 py-2 odd:bg-[var(--meadow)]";

export function SpeciesThumbnail({
	imageUrl,
	comName,
}: {
	imageUrl: string | null;
	comName: string;
}) {
	return (
		<div className="flex size-10 shrink-0 items-center justify-center overflow-hidden">
			{imageUrl ? (
				<img
					src={imageUrl}
					alt=""
					title={comName}
					className="max-h-full max-w-full object-contain"
				/>
			) : (
				<Bird className="size-5 text-muted-foreground" />
			)}
		</div>
	);
}

/**
 * A ranked species row: thumbnail, name, count, and a bar scaled against the
 * leader rather than the total, so the shape of the list reads at a glance even
 * when one species dominates.
 */
export function SpeciesRankRow({
	comName,
	sciName,
	speciesSlug,
	imageUrl,
	count,
	maximum,
}: {
	comName: string;
	sciName: string;
	speciesSlug: string;
	imageUrl: string | null;
	count: number;
	maximum: number;
}) {
	return (
		<li className={LIST_ROW}>
			<SpeciesThumbnail imageUrl={imageUrl} comName={comName} />

			<div className="min-w-0 flex-1">
				<div className="flex items-baseline justify-between gap-2">
					<Link
						to="/species/$sciName"
						params={{ sciName: speciesSlug }}
						className="truncate font-medium no-underline hover:underline"
					>
						{comName}
					</Link>
					<span className="tabular-data shrink-0 font-semibold text-sm">
						{count.toLocaleString()}
					</span>
				</div>
				<div className="truncate text-[var(--bark)] text-xs italic">
					{sciName}
				</div>
				<div
					className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--track)]"
					role="img"
					aria-label={`${count} detections`}
				>
					<div
						className="h-full rounded-full"
						style={{
							width: `${rankingBarPercent(count, maximum)}%`,
							backgroundColor: "var(--moss)",
							opacity: 0.75,
						}}
					/>
				</div>
			</div>
		</li>
	);
}
