import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import type { Detection } from "#/db/schema.ts";
import { getRecentDetections } from "#/lib/detections.ts";
import { usePolledData } from "#/lib/use-polled-data.ts";

const POLL_INTERVAL_MS = 10_000;

export const Route = createFileRoute("/now")({
	component: Now,
	loader: () => getRecentDetections(),
});

function keyFor(d: Detection): string {
	return `${d.Date}-${d.Time}-${d.File_Name}`;
}

function Now() {
	const initial = Route.useLoaderData();
	const { data: detections, lastUpdated } = usePolledData(
		() => getRecentDetections(),
		initial,
		POLL_INTERVAL_MS,
	);

	const seenKeysRef = useRef(new Set(initial.map(keyFor)));
	const [freshKeys, setFreshKeys] = useState<Set<string>>(new Set());

	useEffect(() => {
		const currentKeys = detections.map(keyFor);
		const newlyArrived = currentKeys.filter((k) => !seenKeysRef.current.has(k));
		seenKeysRef.current = new Set(currentKeys);
		if (newlyArrived.length === 0) return;

		setFreshKeys(new Set(newlyArrived));
		const timeout = setTimeout(() => setFreshKeys(new Set()), 2400);
		return () => clearTimeout(timeout);
	}, [detections]);

	const latest = detections[0] as Detection | undefined;
	const rest = detections.slice(1);

	return (
		<div className="page-wrap py-8">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="display-title text-3xl font-semibold">Now</h1>
					<p className="mt-2 text-muted-foreground">
						What's singing at your station, as it happens.
					</p>
				</div>
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<span className="live-dot" aria-hidden="true" />
					<span>
						Live &middot; updated{" "}
						{lastUpdated.toLocaleTimeString([], { timeStyle: "medium" })}
					</span>
				</div>
			</div>

			{latest ? (
				<div
					key={keyFor(latest)}
					className={
						freshKeys.has(keyFor(latest))
							? "feature-card mt-6 rounded-lg p-6 flash-in"
							: "feature-card mt-6 rounded-lg p-6"
					}
				>
					<div className="island-kicker">Latest detection</div>
					<div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
						<h2 className="display-title text-2xl font-bold">
							{latest.Com_Name}
						</h2>
						<span className="italic text-muted-foreground">
							{latest.Sci_Name}
						</span>
					</div>
					<div className="tabular-data mt-2 text-sm text-muted-foreground">
						{latest.Date} {latest.Time}
						{latest.Confidence != null &&
							` · ${Math.round(latest.Confidence * 100)}% confidence`}
					</div>
				</div>
			) : (
				<p className="mt-10 text-muted-foreground">
					No detections yet. Once BirdNET-Pi's analysis pipeline writes to
					birds.db, they'll show up here within {POLL_INTERVAL_MS / 1000}{" "}
					seconds.
				</p>
			)}

			{rest.length > 0 && (
				<>
					<h2 className="display-title mt-10 text-xl font-semibold">
						Recent activity
					</h2>
					<div className="feature-card mt-4 rounded-lg p-2">
						<ul className="divide-y divide-[var(--line)]">
							{rest.map((d) => {
								const key = keyFor(d);
								return (
									<li
										key={key}
										className={
											freshKeys.has(key)
												? "flex items-center justify-between gap-4 rounded-md px-3 py-2 flash-in"
												: "flex items-center justify-between gap-4 rounded-md px-3 py-2"
										}
									>
										<div className="min-w-0">
											<div className="truncate font-medium">{d.Com_Name}</div>
											<div className="truncate text-sm italic text-muted-foreground">
												{d.Sci_Name}
											</div>
										</div>
										<div className="tabular-data shrink-0 text-right text-sm text-muted-foreground">
											<div>{d.Time}</div>
											{d.Confidence != null && (
												<div>{Math.round(d.Confidence * 100)}%</div>
											)}
										</div>
									</li>
								);
							})}
						</ul>
					</div>
				</>
			)}
		</div>
	);
}
