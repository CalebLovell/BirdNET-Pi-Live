import { Link } from "@tanstack/react-router";
import { Gem, Sparkles, Undo2 } from "lucide-react";
import type { CSSProperties } from "react";

import { EmptyNote } from "~/components/empty-state.tsx";
import { SpeciesHourBars } from "~/components/species-hour-bars.tsx";
import { SpeciesThumbnail } from "~/components/species-row.tsx";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/components/ui/tooltip.tsx";
import { confidenceStyle, formatConfidence } from "~/lib/confidence.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";

export type SpeciesGridItem = {
	comName: string;
	sciName: string;
	imageUrl: string | null;
	count: number;
	averageConfidence: number | null;
	isNew: boolean;
	isRare: boolean;
	isReturned: boolean;
	/** The selected period's unit, or null unless isReturned. Returned always means
	    absent the one period before this one, so the pill names a single unit. */
	returnedUnit: "day" | "week" | "month" | "year" | null;
	/** 24 detection counts, midnight first, for this species in the window.
	    Absent when the caller has no hourly breakdown; the row then draws no
	    chart. */
	hourCounts?: number[];
};

export function returnedTooltip(returnedUnit: string | null): string {
	if (returnedUnit == null)
		return "Back after an absence, having missed the previous period.";
	return `Back after an absence — last heard a ${returnedUnit} before.`;
}

// Each status pill wears its own tint over the raised paper, so a glance down the
// grid sorts them by hue -- and none reuses the confidence pill's moss/sand/sage
// scale, which reads as data rather than as a flag. Blue for a first arrival,
// rose for a bird back from a long absence, heather for a rare visitor.
const NEW_PILL_STYLE: CSSProperties = {
	backgroundColor: "color-mix(in oklab, #3f6ea6 20%, var(--paper-raised))",
	color: "#2a4d78",
};

const RETURNED_PILL_STYLE: CSSProperties = {
	backgroundColor: "color-mix(in oklab, #a8536e 20%, var(--paper-raised))",
	color: "#733a4e",
};

const RARE_PILL_STYLE: CSSProperties = {
	backgroundColor: "color-mix(in oklab, #6f5c9c 22%, var(--paper-raised))",
	color: "#463a73",
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
		<li className="flex min-h-16 min-w-0 flex-col gap-2 rounded-md bg-[var(--meadow)] px-3 py-2">
			<div className="flex min-w-0 items-center gap-3">
				<SpeciesThumbnail imageUrl={item.imageUrl} comName={item.comName} />

				{/* LEFT: who the bird is -- common name over its scientific name. */}
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

				{/* RIGHT: everything measured about it -- the count and its flags. */}
				<div className="flex shrink-0 flex-col items-end gap-1.5">
					<span className="tabular-data font-semibold text-sm">
						{item.count.toLocaleString()}
					</span>
					<div className="flex flex-wrap items-center justify-end gap-1.5">
						{item.averageConfidence != null ? (
							<Pill
								label={formatConfidence(item.averageConfidence)}
								style={confidenceStyle(item.averageConfidence)}
								tabular
							/>
						) : null}
						{item.isNew && newLabel ? (
							<Pill
								icon={Sparkles}
								label="New"
								style={NEW_PILL_STYLE}
								tooltip={`First recorded here in ${newLabel}`}
							/>
						) : null}
						{item.isReturned ? (
							<Pill
								icon={Undo2}
								label="Returned"
								style={RETURNED_PILL_STYLE}
								tooltip={returnedTooltip(item.returnedUnit)}
							/>
						) : null}
						{item.isRare ? (
							<Pill
								icon={Gem}
								label="Rare"
								style={RARE_PILL_STYLE}
								tooltip="Barely ever heard here — a rare visitor."
							/>
						) : null}
					</div>
				</div>
			</div>

			{/* The bird's day at a glance, under its name. Hairline off the meadow
			    so it reads as the same tile, not a nested card. */}
			{item.hourCounts ? (
				<SpeciesHourBars
					comName={item.comName}
					hourCounts={item.hourCounts}
					className="border-[var(--line)] border-t pt-2"
				/>
			) : null}
		</li>
	);
}

/**
 * One pill in a row's cluster. Every pill -- confidence, New, Returned, Rare --
 * shares this size, radius and weight so the cluster reads as one family; only
 * the tint and the optional icon set them apart. The flag pills carry a tooltip
 * explaining what they mean; the confidence pill is a bare number, so it takes
 * no tooltip and renders without one.
 */
function Pill({
	icon: Icon,
	label,
	style,
	tooltip,
	tabular = false,
}: {
	icon?: React.ComponentType<{ className?: string }>;
	label: string;
	style: CSSProperties;
	tooltip?: string;
	tabular?: boolean;
}) {
	const pill = (
		<span
			className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-[11px] leading-none ${tabular ? "tabular-data" : ""}`}
			style={style}
		>
			{Icon ? <Icon className="size-2.5" /> : null}
			{label}
		</span>
	);

	if (!tooltip) return pill;

	return (
		<Tooltip>
			<TooltipTrigger asChild>{pill}</TooltipTrigger>
			<TooltipContent>{tooltip}</TooltipContent>
		</Tooltip>
	);
}
