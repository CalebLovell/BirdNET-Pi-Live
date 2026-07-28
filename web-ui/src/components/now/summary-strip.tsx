import { useShareCard } from "~/components/use-share-card.tsx";
import type { NowSummary } from "~/lib/now.ts";
import { formatShareCard } from "~/lib/share-card.ts";
import { getShareCard } from "~/lib/share-card-data.ts";
import { hourLabel } from "~/lib/time-ago.ts";

export function SummaryStrip({ summary }: { summary: NowSummary }) {
	// The share control belongs to the card holding the figures it summarises,
	// not to a button standing on its own beneath it.
	const share = useShareCard({
		label: "Share today",
		load: () => getShareCard().then(formatShareCard),
	});

	// Nothing in the window means there is nothing to summarise: three zeros beside
	// a dash reads as a broken card rather than a quiet night. The share control
	// goes with them, since the card it would produce would be empty too.
	const isEmpty = summary.detections === 0;

	return (
		<section
			aria-label="Last 24 hours"
			className="feature-card mt-4 rounded-md p-4"
		>
			<div className="flex items-center justify-between gap-3">
				<div className="island-kicker">Last 24 hours</div>
				{isEmpty ? null : share.trigger}
			</div>

			{isEmpty ? (
				<p className="mt-4 text-muted-foreground text-sm">
					No detections recorded in the last 24 hours.
				</p>
			) : (
				<>
					<dl className="mt-4 grid grid-cols-2 gap-y-6 sm:grid-cols-4 sm:gap-y-0 sm:divide-x sm:divide-[var(--line)]">
						<Figure value={summary.species} label="Species" />
						<Figure value={summary.detections} label="Detections" />
						<Figure
							value={summary.visits}
							label="Visits"
							hint="Detection runs separated by 15+ minutes of silence"
						/>
						<Figure
							value={
								summary.busiestHour ? hourLabel(summary.busiestHour.hour) : "—"
							}
							label="Busiest hour"
							detail={
								summary.busiestHour
									? `${summary.busiestHour.count.toLocaleString()} detections`
									: undefined
							}
						/>
					</dl>

					{share.summary}
				</>
			)}
		</section>
	);
}

function Figure({
	value,
	label,
	detail,
	hint,
}: {
	value: string | number;
	label: string;
	detail?: string;
	hint?: string;
}) {
	return (
		<div className="sm:px-6 sm:last:pr-0 sm:first:pl-0">
			<dd className="tabular-data display-title font-semibold text-3xl sm:text-4xl">
				{typeof value === "number" ? value.toLocaleString() : value}
			</dd>
			<dt
				className="mt-1 text-muted-foreground text-sm"
				title={hint}
				aria-description={hint}
			>
				{label}
			</dt>
			{detail && (
				<div className="tabular-data text-muted-foreground text-xs">
					{detail}
				</div>
			)}
		</div>
	);
}
