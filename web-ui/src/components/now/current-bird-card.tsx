import type { ReactNode } from "react";

import {
	HERO_CARD_SHELL,
	HeroCardShell,
	SpeciesHeroCard,
} from "~/components/species-hero-card.tsx";
import { useShareCard } from "~/components/use-share-card.tsx";
import type { CurrentBird, NowSummary } from "~/lib/now.ts";
import { formatShareCard } from "~/lib/share-card.ts";
import { getShareCard } from "~/lib/share-card-data.ts";
import { formatClockTime, formatTimeAgo } from "~/lib/time-ago.ts";

/**
 * The page's masthead: the most recent detection as its portrait, and the
 * station's last 24 hours as its figures. The bird is what the card looks like;
 * the window is what it is about, so the figures stay put as detections come and
 * go beneath them. There is deliberately no "singing now" / "quiet" styling: a
 * station that last heard something five seconds ago and one that last heard
 * something five days ago get the same card, and the relative time is left to
 * say which it is.
 */
export function CurrentBirdCard({
	current,
	summary,
	offsetMs,
	flash,
}: {
	current: CurrentBird | null;
	summary: NowSummary;
	offsetMs: number;
	flash: boolean;
}) {
	// The share control belongs to the card holding the figures it summarises,
	// not to a button standing on its own beneath it. Nothing in the window means
	// the card it would produce would be empty, so the control goes with it.
	const share = useShareCard({
		load: () => getShareCard().then(formatShareCard),
	});
	const canShare = summary.detections > 0;

	// The only state worth distinguishing: a station whose database is still
	// empty, where there is no detection to render a card from at all.
	if (!current) {
		return (
			<HeroCardShell label="Station status" portrait={<NestPortrait />}>
				<CenteredBody>
					<h1 className="display-title font-bold text-2xl sm:text-3xl">
						Nothing recorded yet
					</h1>
					<p className="text-muted-foreground">
						Once BirdNET-Pi's analysis pipeline writes to birds.db, detections
						will appear here on their own.
					</p>
				</CenteredBody>
			</HeroCardShell>
		);
	}

	// The server measured this age, so it is already correct on the first paint --
	// `offsetMs` is 0 through hydration and only ages it forward from there.
	const elapsedMs = current.ageMs + offsetMs;

	// No figure row: the station's counts live in the cards below -- Top
	// detections, the log, the Live story -- so repeating them in the masthead
	// only duplicates what the page already shows.
	return (
		<SpeciesHeroCard
			label="Last 24 hours"
			actions={canShare ? share.trigger : undefined}
			footer={canShare ? share.summary : undefined}
			comName={current.comName}
			sciName={current.sciName}
			speciesSlug={current.speciesSlug}
			imageUrl={current.imageUrl}
			relativeTime={formatTimeAgo(elapsedMs)}
			clockTime={formatClockTime(current.detectedAt)}
			confidence={current.confidence}
			audioUrl={current.audioUrl}
			className={flash ? `${HERO_CARD_SHELL} flash-in` : HERO_CARD_SHELL}
		/>
	);
}

function CenteredBody({ children }: { children: ReactNode }) {
	return (
		<div className="flex flex-1 flex-col justify-center gap-2">{children}</div>
	);
}

function NestPortrait() {
	return (
		// Aligned like HeroPortrait, so the empty state sits in the same slot as
		// the bird it stands in for.
		<div className="flex h-32 w-full items-center justify-center overflow-hidden sm:h-36">
			<img
				src="/illustrations/nest.webp"
				alt="An empty nest"
				className="max-h-full max-w-full object-contain"
			/>
		</div>
	);
}
