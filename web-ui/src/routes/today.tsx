import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { CurrentBirdCard } from "~/components/now/current-bird-card.tsx";
import { RecentLogCard } from "~/components/now/recent-log-card.tsx";
import { SummaryStrip } from "~/components/now/summary-strip.tsx";
import { SpeciesList } from "~/components/species-list.tsx";
import { usePublishLiveStatus } from "~/lib/live-status.ts";
import { getNowSnapshot } from "~/lib/now.ts";
import { pageTitle } from "~/lib/page-title.ts";
import { useAgeOffset } from "~/lib/use-age-offset.ts";
import { useFavicon } from "~/lib/use-favicon.ts";
import { usePolledData } from "~/lib/use-polled-data.ts";

const POLL_INTERVAL_MS = 10_000;
const FLASH_DURATION_MS = 2_400;

export const Route = createFileRoute("/today")({
	head: () => ({ meta: [{ title: pageTitle("Today") }] }),
	component: Today,
	loader: () => getNowSnapshot(),
});

/**
 * Keys that arrived since the previous poll, held just long enough for the
 * flash-in highlight to play. Keys travel as a joined signature so the effect
 * compares by value -- a fresh array of identical keys arrives on every poll.
 */
function useFreshKeys(keys: string[]): Set<string> {
	const signature = keys.join("|");
	const seenRef = useRef(new Set(keys));
	const [freshKeys, setFreshKeys] = useState<Set<string>>(new Set());

	useEffect(() => {
		const currentKeys = signature.length > 0 ? signature.split("|") : [];
		const arrived = currentKeys.filter((key) => !seenRef.current.has(key));
		seenRef.current = new Set(currentKeys);
		if (arrived.length === 0) return;

		setFreshKeys(new Set(arrived));
		const timeout = setTimeout(
			() => setFreshKeys(new Set()),
			FLASH_DURATION_MS,
		);
		return () => clearTimeout(timeout);
	}, [signature]);

	return freshKeys;
}

function Today() {
	const initial = Route.useLoaderData();
	const { data: snapshot } = usePolledData(
		() => getNowSnapshot(),
		initial,
		POLL_INTERVAL_MS,
	);
	const offsetMs = useAgeOffset(snapshot.generatedAt);
	// The footer carries the station's liveness for the whole site, so the page
	// that actually polls is what tells it when the last snapshot landed.
	usePublishLiveStatus(snapshot.generatedAt);
	const freshKeys = useFreshKeys(snapshot.recent.map((row) => row.key));
	// Follows the poll rather than the loader, so the tab keeps pace with the hero
	// card as new birds arrive. It reuses the hero's own image, whatever that
	// turned out to be, so the two never disagree and the browser fetches once.
	// A null here means nothing has ever been heard, and the nest is what the
	// hero card is showing too.
	useFavicon(snapshot.current?.imageUrl ?? null);

	// Whenever anything has been heard inside the window, the hero bird is also
	// the newest row in the log, so its arrival is already tracked and needs no
	// second mechanism. Outside the window the log is empty, and the hero is
	// showing an older detection that did not just arrive -- nothing to flash.
	const newestKey = snapshot.recent[0]?.key;
	const heroIsNew = newestKey !== undefined && freshKeys.has(newestKey);

	return (
		<div className="page-wrap py-4">
			<CurrentBirdCard
				current={snapshot.current}
				offsetMs={offsetMs}
				flash={heroIsNew}
			/>

			<SummaryStrip summary={snapshot.summary} />

			<div className="mt-4 grid gap-4 lg:grid-cols-2">
				<SpeciesList
					title="Top detections"
					ariaLabel="Top detections in the last 24 hours"
					species={snapshot.topSpecies}
					emptyMessage="No detections recorded in the last 24 hours."
				/>
				<RecentLogCard
					recent={snapshot.recent}
					offsetMs={offsetMs}
					freshKeys={freshKeys}
				/>
			</div>
		</div>
	);
}
