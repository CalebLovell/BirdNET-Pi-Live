import { Link } from "@tanstack/react-router";
import { Bird } from "lucide-react";
import type { ReactNode } from "react";

import { ConfidencePill } from "~/components/confidence-pill.tsx";
import { RecordingButton } from "~/components/recording-button.tsx";
import { formatConfidence } from "~/lib/confidence.ts";
import type { CurrentBird, NowSummary } from "~/lib/now.ts";
import {
	formatClockTime,
	formatTimeAgo,
	freshnessFor,
} from "~/lib/time-ago.ts";

const CARD_SHELL =
	"feature-card grid gap-4 rounded-md p-4 sm:grid-cols-[14rem_minmax(0,1fr)] sm:p-6";

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
	if (!current) {
		return (
			<HeroCard
				label="Station status"
				kicker="Waiting"
				portrait={<NestPortrait />}
			>
				<CenteredBody>
					<h1 className="display-title font-bold text-2xl sm:text-3xl">
						Nothing recorded yet
					</h1>
					<p className="text-muted-foreground">
						Once BirdNET-Pi's analysis pipeline writes to birds.db, detections
						will appear here on their own.
					</p>
				</CenteredBody>
			</HeroCard>
		);
	}

	// The server measured this age, so it is already correct on the first paint --
	// `offsetMs` is 0 through hydration and only ages it forward from there. That
	// is what stops the card from flashing one state and then correcting itself.
	const elapsedMs = current.ageMs + offsetMs;
	const freshness = freshnessFor(elapsedMs);

	if (freshness === "quiet") {
		return (
			<HeroCard
				label="Station status"
				kicker="All quiet"
				portrait={<NestPortrait />}
			>
				<CenteredBody>
					<h1 className="display-title font-bold text-2xl sm:text-3xl">
						It's quiet outside right now
					</h1>
					<p className="text-muted-foreground">
						Last heard{" "}
						<Link
							to="/species/$comName"
							params={{ comName: current.speciesSlug }}
							className="font-medium"
						>
							{current.comName}
						</Link>{" "}
						{formatTimeAgo(elapsedMs)}, at{" "}
						<span className="tabular-data">
							{formatClockTime(current.detectedAt)}
						</span>
						.
					</p>
					<p className="tabular-data text-muted-foreground text-sm">
						{summary.detections.toLocaleString()} detections from{" "}
						{summary.species} species in the last 24 hours.
					</p>
				</CenteredBody>
			</HeroCard>
		);
	}

	const isSinging = freshness === "singing";

	return (
		<HeroCard
			label="Currently singing"
			kicker={isSinging ? "Singing now" : "Last heard"}
			portrait={
				<BirdPortrait imageUrl={current.imageUrl} comName={current.comName} />
			}
			className={flash ? `${CARD_SHELL} flash-in` : CARD_SHELL}
			style={isSinging ? { borderColor: "var(--hover-line)" } : undefined}
		>
			<div className="flex-1">
				<h1 className="display-title font-bold text-2xl sm:text-3xl">
					<Link
						to="/species/$comName"
						params={{ comName: current.speciesSlug }}
						className="no-underline hover:underline"
					>
						{current.comName}
					</Link>
				</h1>
				<p className="text-[var(--bark)] text-xs italic">{current.sciName}</p>

				<p className="mt-3 font-semibold text-[var(--moss)] text-lg">
					{formatTimeAgo(elapsedMs)}
				</p>
				<div className="tabular-data mt-1 flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
					<span>at {formatClockTime(current.detectedAt)}</span>
					<ConfidencePill confidence={current.confidence} />
					<RecordingButton audioUrl={current.audioUrl} />
				</div>
			</div>

			<dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
				<Stat label="Heard in 24h" value={current.countLast24h} />
				<Stat label="Visits in 24h" value={current.visitsLast24h} />
				<Stat
					label="Avg. confidence"
					value={formatConfidence(current.averageConfidence)}
				/>
				<Stat label="All-time" value={current.allTimeCount} />
			</dl>
		</HeroCard>
	);
}

/**
 * Shared shell for every hero state: portrait on the left, and a content column
 * bracketed by the live pill (top right) and the poll timestamp (bottom right),
 * so the station's liveness reads the same whatever the card is saying.
 */
function HeroCard({
	label,
	kicker,
	portrait,
	className = CARD_SHELL,
	style,
	children,
}: {
	label: string;
	kicker: string;
	portrait: ReactNode;
	className?: string;
	style?: React.CSSProperties;
	children: ReactNode;
}) {
	return (
		<section aria-label={label} className={className} style={style}>
			{portrait}

			<div className="flex min-w-0 flex-col gap-3">
				<div className="island-kicker">{kicker}</div>

				{children}
			</div>
		</section>
	);
}

function CenteredBody({ children }: { children: ReactNode }) {
	return (
		<div className="flex flex-1 flex-col justify-center gap-2">{children}</div>
	);
}

function NestPortrait() {
	return (
		<div className="flex h-40 w-full items-center justify-center overflow-hidden sm:h-48">
			<img
				src="/illustrations/nest.webp"
				alt="An empty nest"
				className="max-h-full max-w-52 object-contain"
			/>
		</div>
	);
}

function BirdPortrait({
	imageUrl,
	comName,
}: {
	imageUrl: string | null;
	comName: string;
}) {
	return (
		<div className="flex h-40 w-full shrink-0 items-center justify-center overflow-hidden sm:h-48">
			{imageUrl ? (
				<img
					src={imageUrl}
					alt={comName}
					className="max-h-full max-w-52 object-contain"
				/>
			) : (
				<Bird className="size-16 text-muted-foreground" />
			)}
		</div>
	);
}

function Stat({ label, value }: { label: string; value: string | number }) {
	return (
		<div>
			<dd className="tabular-data truncate font-semibold">{value}</dd>
			<dt className="text-muted-foreground text-xs">{label}</dt>
		</div>
	);
}
