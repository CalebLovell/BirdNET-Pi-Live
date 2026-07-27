import { useLiveStatus } from "~/lib/live-status.ts";
import { formatClockTimeWithSeconds } from "~/lib/time-ago.ts";

export function Footer() {
	const generatedAt = useLiveStatus();

	return (
		<footer className="site-footer">
			<div className="page-wrap flex h-14 items-center justify-between text-muted-foreground text-sm">
				<div className="flex items-center gap-2">
					<LivePill />
					{/* Only the polling page has a time to show; elsewhere the pill
					    stands alone rather than naming a moment nothing refreshes. */}
					{generatedAt ? (
						<span className="tabular-data text-[11px]">
							Updated {formatClockTimeWithSeconds(generatedAt)}
						</span>
					) : null}
				</div>
				<a
					href="https://github.com/kahst/BirdNET-Analyzer"
					className="nav-link"
				>
					Powered by BirdNET
				</a>
			</div>
		</footer>
	);
}

/**
 * Borrows the confidence pills' shape so the polling indicator reads as part of
 * the same family. It lives in the site chrome rather than in the Today hero:
 * the station's liveness describes the station, not whatever card happens to be
 * at the top of one page.
 */
function LivePill() {
	return (
		<span
			className="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold text-[10px] uppercase tracking-[0.14em]"
			style={{
				backgroundColor:
					"color-mix(in oklab, var(--moss) 10%, var(--paper-raised))",
				color: "var(--moss)",
			}}
		>
			<span className="live-dot" aria-hidden="true" />
			Live
		</span>
	);
}
