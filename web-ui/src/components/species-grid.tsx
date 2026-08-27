import { Link } from "@tanstack/react-router";
import { Gem, Sparkles } from "lucide-react";

import { ConfidencePill } from "~/components/confidence-pill.tsx";
import { EmptyNote } from "~/components/empty-state.tsx";
import { SpeciesThumbnail } from "~/components/species-row.tsx";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/components/ui/tooltip.tsx";
import { comNameToSlug } from "~/lib/species-slug.ts";

export type SpeciesGridItem = {
	comName: string;
	sciName: string;
	imageUrl: string | null;
	count: number;
	averageConfidence: number | null;
	isNew: boolean;
	isRare: boolean;
};

/**
 * Every species heard in the window, as a responsive grid of illustrated rows.
 * The same object on every period: the picture, the name, how often it was
 * heard, how confident those calls were, and chips for what stands out about it
 * (first arrival here, rare visitor). One feature-card holding meadow-tinted
 * rows -- not a grid of nested cards.
 */
export function SpeciesGrid({
	species,
	newLabel,
	emptyMessage,
	className = "",
}: {
	species: SpeciesGridItem[];
	/** Names the window in the "New" chip tooltip. Null hides the chip entirely,
	    which is what "all time" wants: everything is trivially first heard. */
	newLabel: string | null;
	emptyMessage: string;
	className?: string;
}) {
	return (
		<TooltipProvider>
			<section
				aria-label="Species"
				className={`feature-card rounded-md p-4 ${className}`}
			>
				<div className={`island-kicker ${species.length === 0 ? "" : "mb-4"}`}>
					Species
				</div>

				{species.length === 0 ? (
					<EmptyNote>{emptyMessage}</EmptyNote>
				) : (
					<ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
						{species.map((item) => (
							<SpeciesGridRow
								key={item.comName}
								item={item}
								newLabel={newLabel}
							/>
						))}
					</ul>
				)}
			</section>
		</TooltipProvider>
	);
}

function SpeciesGridRow({
	item,
	newLabel,
}: {
	item: SpeciesGridItem;
	newLabel: string | null;
}) {
	return (
		<li className="flex min-h-16 min-w-0 items-center gap-3 rounded-md bg-[var(--meadow)] px-3 py-2">
			<SpeciesThumbnail imageUrl={item.imageUrl} comName={item.comName} />

			<div className="min-w-0 flex-1">
				<div className="flex items-baseline justify-between gap-2">
					<Link
						to="/species/$comName"
						params={{ comName: comNameToSlug(item.comName) }}
						className="truncate font-medium no-underline hover:underline"
					>
						{item.comName}
					</Link>
					<span className="tabular-data shrink-0 font-semibold text-sm">
						{item.count.toLocaleString()}
					</span>
				</div>
				<div className="truncate text-[var(--bark)] text-xs italic">
					{item.sciName}
				</div>
				<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
					<ConfidencePill confidence={item.averageConfidence} />
					{item.isNew && newLabel ? (
						<Chip
							icon={Sparkles}
							label="New"
							tooltip={`First recorded here in ${newLabel}`}
						/>
					) : null}
					{item.isRare ? (
						<Chip
							icon={Gem}
							label="Rare"
							tooltip="Barely ever heard here — a rare visitor."
						/>
					) : null}
				</div>
			</div>
		</li>
	);
}

/**
 * A small labelled icon chip, styled to match the "New" / "First ever" badges
 * already used on the day and species-by-hour views.
 */
function Chip({
	icon: Icon,
	label,
	tooltip,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	tooltip: string;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span
					className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] leading-none"
					style={{
						backgroundColor:
							"color-mix(in oklab, var(--sand) 22%, var(--paper-raised))",
						color: "var(--bark)",
					}}
				>
					<Icon className="size-2.5" />
					{label}
				</span>
			</TooltipTrigger>
			<TooltipContent>{tooltip}</TooltipContent>
		</Tooltip>
	);
}
