import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
	formatStationTally,
	getStationStatus,
	type StationStatus as StationReading,
} from "~/lib/station.ts";
import { formatClockTimeWithSeconds, formatTimeAgo } from "~/lib/time-ago.ts";
import { useAgeOffset } from "~/lib/use-age-offset.ts";

const POLL_INTERVAL_MS = 15_000;

/**
 * The station's own reading, fetched on mount and then polled.
 *
 * The sidebar renders in the root shell, outside the route tree, so it has no
 * loader to hang this off -- hence the fetch-on-mount rather than the
 * loader-plus-`usePolledData` pattern the routes use. Null until the first
 * response lands, which the caller renders as placeholder rows.
 */
function useStationStatus(): StationReading | null {
	const [reading, setReading] = useState<StationReading | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function read() {
			try {
				const next = await getStationStatus();
				if (!cancelled) setReading(next);
			} catch {
				// A transient failure shouldn't kill polling -- the next tick retries,
				// and the sidebar keeps showing the last good reading meanwhile.
			}
		}

		read();
		const id = setInterval(read, POLL_INTERVAL_MS);
		return () => {
			cancelled = true;
			clearInterval(id);
		};
	}, []);

	return reading;
}

/**
 * Station liveness in the sidebar's lower section. It lives in the site chrome
 * rather than on one page because the station's state describes the station,
 * not whatever card happens to be at the top of a route.
 */
export function StationStatus() {
	const reading = useStationStatus();
	// Ages the server-measured `ageMs` forward between polls, re-basing each time
	// a fresh reading lands.
	const offsetMs = useAgeOffset(reading?.generatedAt ?? "");

	return (
		<section className="px-4 py-3">
			<h2 className="island-kicker mb-2">Station</h2>

			<LivePill />

			{/* Fixed-height rows whether or not the reading has landed, so the first
			    response fills them in rather than shoving the footer down. */}
			<dl className="mt-2 space-y-1 text-[11px] text-muted-foreground leading-tight">
				<StatusRow label="Updated">
					{reading ? (
						<span className="tabular-data">
							{formatClockTimeWithSeconds(reading.generatedAt)}
						</span>
					) : null}
				</StatusRow>

				<StatusRow label="Latest">
					{reading?.latest ? (
						<Link
							to="/species/$comName"
							params={{ comName: reading.latest.speciesSlug }}
							className="nav-link"
						>
							{reading.latest.comName}
							<span className="tabular-data">
								{" "}
								· {formatTimeAgo(reading.latest.ageMs + offsetMs)}
							</span>
						</Link>
					) : null}
				</StatusRow>

				<StatusRow label="Last 24h">
					{reading ? (
						<span className="tabular-data">
							{formatStationTally(reading.species24h, reading.detections24h)}
						</span>
					) : null}
				</StatusRow>
			</dl>
		</section>
	);
}

function StatusRow({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="min-h-[1.4em]">
			<dt className="sr-only">{label}</dt>
			<dd className="m-0 truncate">{children}</dd>
		</div>
	);
}

/**
 * Borrows the confidence pills' shape so the polling indicator reads as part of
 * the same family.
 */
function LivePill() {
	return (
		<span
			className="flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold text-[10px] uppercase tracking-[0.14em]"
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
