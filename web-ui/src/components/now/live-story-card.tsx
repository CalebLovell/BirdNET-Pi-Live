import { Link } from "@tanstack/react-router";
import {
	Bird,
	Clock,
	Cloud,
	Gem,
	Home,
	type LucideIcon,
	Sprout,
	TrendingUp,
	Undo2,
} from "lucide-react";

import { SpeciesThumbnail } from "~/components/species-row.tsx";
import type { StoryLine, StoryMention, StoryTone } from "~/lib/story-data.ts";

/**
 * One icon per rule. The tone is the only thing the card reads off a line --
 * the wording is settled server-side in lib/story-data.ts, so a change to how
 * the story speaks never means touching this file.
 */
const TONE_ICONS: Record<StoryTone, LucideIcon> = {
	new: Bird,
	return: Undo2,
	rare: Gem,
	routine: Clock,
	busy: TrendingUp,
	quiet: Cloud,
	calm: Home,
	learning: Sprout,
};

/**
 * Live: what the last 24 hours were worth saying, if anything.
 *
 * The lines arrive already gated -- the card's job is only to make them read
 * like observations rather than a readout. Every line that names birds names
 * them as birds, with the illustration and a link through to the species, on
 * the principle that a species is never just a string in a sentence here.
 */
export function LiveStoryCard({
	lines,
	className = "",
}: {
	lines: StoryLine[];
	/** Layout classes from the page, e.g. its margin. Passed here rather than
	    to a wrapper so that a story with nothing to say leaves no gap behind. */
	className?: string;
}) {
	// An empty story means a station with no recordings at all. The hero card
	// above is already saying so, and far more plainly than this card could.
	if (lines.length === 0) return null;

	return (
		<section
			aria-label="Live"
			className={`feature-card rounded-md p-4 ${className}`}
		>
			<div className="island-kicker">Live</div>

			<ul className="mt-4 space-y-3">
				{lines.map((line) => (
					<StoryLineRow key={line.tone} line={line} />
				))}
			</ul>
		</section>
	);
}

function StoryLineRow({ line }: { line: StoryLine }) {
	const Icon = TONE_ICONS[line.tone];

	return (
		<li className="flex gap-3 rounded-md px-3 py-2 odd:bg-[var(--meadow)]">
			<Icon
				aria-hidden="true"
				className="mt-0.5 size-4 shrink-0 text-[var(--moss)]"
			/>

			<div className="min-w-0 flex-1">
				<p className="font-medium">{line.headline}</p>
				{line.detail ? (
					<p className="mt-0.5 text-muted-foreground text-sm">{line.detail}</p>
				) : null}

				{line.species.length > 0 ? (
					<ul className="mt-2 flex flex-wrap gap-2">
						{line.species.map((species) => (
							<li key={species.comName}>
								<MentionChip species={species} />
							</li>
						))}
						{line.moreCount > 0 ? (
							<li className="self-center text-muted-foreground text-sm">
								and {line.moreCount} more
							</li>
						) : null}
					</ul>
				) : null}
			</div>
		</li>
	);
}

/** A named bird: the illustration, the name, and what put it in this line. */
function MentionChip({ species }: { species: StoryMention }) {
	return (
		<Link
			to="/species/$comName"
			params={{ comName: species.speciesSlug }}
			className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] py-1 pr-3 pl-1 no-underline hover:border-[var(--hover-line)]"
		>
			<SpeciesThumbnail imageUrl={species.imageUrl} comName={species.comName} />
			<span className="min-w-0">
				<span className="block truncate font-medium text-sm hover:underline">
					{species.comName}
				</span>
				{species.note ? (
					<span className="block truncate text-[var(--bark)] text-xs">
						{species.note}
					</span>
				) : null}
			</span>
		</Link>
	);
}
