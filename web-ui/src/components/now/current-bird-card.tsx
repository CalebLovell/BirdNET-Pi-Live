import {
	AudioLines,
	ChartNoAxesColumnIncreasing,
	Footprints,
	Gauge,
} from "lucide-react";
import type { ReactNode } from "react";

import type { PageHeaderStat } from "~/components/page-header-card.tsx";
import {
	HERO_CARD_SHELL,
	HeroCardShell,
	SpeciesHeroCard,
} from "~/components/species-hero-card.tsx";
import { formatConfidence } from "~/lib/confidence.ts";
import type { CurrentBird } from "~/lib/now.ts";
import { formatClockTime, formatTimeAgo } from "~/lib/time-ago.ts";

/**
 * The most recent detection, however long ago it was. There is deliberately no
 * "singing now" / "quiet" styling: a station that last heard something five
 * seconds ago and one that last heard something five days ago get the same card,
 * and the relative time is left to say which it is.
 */
export function CurrentBirdCard({
	current,
	offsetMs,
	flash,
}: {
	current: CurrentBird | null;
	offsetMs: number;
	flash: boolean;
}) {
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

	// The station's all-time count for this species leads, so the card opens on
	// the same two figures the species page does before the 24-hour pair.
	const stats = [
		{
			label: "Total detections",
			value: current.allTimeCount,
			icon: ChartNoAxesColumnIncreasing,
		},
		{
			label: "Avg. confidence",
			value: formatConfidence(current.averageConfidence),
			icon: Gauge,
		},
		{
			label: "Heard in 24h",
			value: current.countLast24h,
			icon: AudioLines,
		},
		{
			label: "Visits in 24h",
			value: current.visitsLast24h,
			icon: Footprints,
			hint: "Detection runs separated by 15+ minutes of silence",
		},
	] satisfies PageHeaderStat[];

	return (
		<SpeciesHeroCard
			label="Most recent detection"
			comName={current.comName}
			sciName={current.sciName}
			speciesSlug={current.speciesSlug}
			imageUrl={current.imageUrl}
			relativeTime={formatTimeAgo(elapsedMs)}
			clockTime={formatClockTime(current.detectedAt)}
			confidence={current.confidence}
			audioUrl={current.audioUrl}
			stats={stats}
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
		<div className="flex h-40 w-full items-center justify-center overflow-hidden sm:h-44">
			<img
				src="/illustrations/nest.webp"
				alt="An empty nest"
				className="max-h-full max-w-full object-contain"
			/>
		</div>
	);
}
