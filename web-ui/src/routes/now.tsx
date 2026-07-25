import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { CurrentBirdCard } from "~/components/now/current-bird-card.tsx";
import { RecentLogCard } from "~/components/now/recent-log-card.tsx";
import { SummaryStrip } from "~/components/now/summary-strip.tsx";
import { TopDetectionsCard } from "~/components/now/top-detections-card.tsx";
import { getNowSnapshot } from "~/lib/now.ts";
import { useAgeOffset } from "~/lib/use-age-offset.ts";
import { usePolledData } from "~/lib/use-polled-data.ts";

const POLL_INTERVAL_MS = 10_000;
const FLASH_DURATION_MS = 2_400;

export const Route = createFileRoute("/now")({
	component: Now,
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

function Now() {
	const initial = Route.useLoaderData();
	const { data: snapshot } = usePolledData(
		() => getNowSnapshot(),
		initial,
		POLL_INTERVAL_MS,
	);
	const offsetMs = useAgeOffset(snapshot.generatedAt);
	const freshKeys = useFreshKeys(snapshot.recent.map((row) => row.key));

	// Whenever anything has been heard inside the window, the hero bird is also
	// the newest row in the log, so its arrival is already tracked and needs no
	// second freshness mechanism. Outside the window the log is empty and the
	// hero sits in its quiet state, where there is nothing to flash.
	const newestKey = snapshot.recent[0]?.key;
	const heroIsNew = newestKey !== undefined && freshKeys.has(newestKey);

	return (
		<div className="page-wrap py-4">
			<CurrentBirdCard
				current={snapshot.current}
				summary={snapshot.summary}
				generatedAt={snapshot.generatedAt}
				offsetMs={offsetMs}
				flash={heroIsNew}
			/>

			<SummaryStrip summary={snapshot.summary} />

			<div className="mt-4 grid gap-4 lg:grid-cols-2">
				<TopDetectionsCard topSpecies={snapshot.topSpecies} />
				<RecentLogCard
					recent={snapshot.recent}
					offsetMs={offsetMs}
					freshKeys={freshKeys}
				/>
			</div>
		</div>
	);
}
