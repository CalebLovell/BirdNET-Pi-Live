import { Link } from "@tanstack/react-router";
import { Bird } from "lucide-react";

import type { TopSpecies } from "~/lib/now.ts";

export function TopDetectionsCard({
	topSpecies,
}: {
	topSpecies: TopSpecies[];
}) {
	// Bars are scaled against the leader rather than the total, so the shape of
	// the morning reads at a glance even when one species dominates.
	const leader = topSpecies[0]?.count ?? 0;

	return (
		<section
			aria-label="Top detections in the last 24 hours"
			className="feature-card flex flex-col rounded-md p-4 sm:p-6"
		>
			<div className="island-kicker">Top detections</div>

			{topSpecies.length === 0 ? (
				<p className="mt-4 text-muted-foreground text-sm">
					Nothing detected in the last 24 hours.
				</p>
			) : (
				<ol className="mt-4 space-y-3">
					{topSpecies.map((species, index) => (
						<li key={species.comName} className="flex items-center gap-3">
							<span className="tabular-data w-4 shrink-0 text-muted-foreground text-sm">
								{index + 1}
							</span>

							<div className="flex size-10 shrink-0 items-center justify-center overflow-hidden">
								{species.imageUrl ? (
									<img
										src={species.imageUrl}
										alt=""
										className="max-h-full max-w-full object-contain"
									/>
								) : (
									<Bird className="size-5 text-muted-foreground" />
								)}
							</div>

							<div className="min-w-0 flex-1">
								<div className="flex items-baseline justify-between gap-2">
									<Link
										to="/species/$sciName"
										params={{ sciName: species.speciesSlug }}
										className="truncate font-medium no-underline hover:underline"
									>
										{species.comName}
									</Link>
									<span className="tabular-data shrink-0 font-semibold text-sm">
										{species.count.toLocaleString()}
									</span>
								</div>
								<div className="truncate text-muted-foreground text-xs italic">
									{species.sciName}
								</div>
								<div
									className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--meadow)]"
									role="img"
									aria-label={`${species.count} detections`}
								>
									<div
										className="h-full rounded-full"
										style={{
											width:
												leader > 0
													? `${(species.count / leader) * 100}%`
													: "0%",
											backgroundColor: "var(--moss)",
											opacity: 0.75,
										}}
									/>
								</div>
							</div>
						</li>
					))}
				</ol>
			)}
		</section>
	);
}
