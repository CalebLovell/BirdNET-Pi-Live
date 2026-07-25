import { SpeciesRankRow } from "~/components/species-rank-row.tsx";
import type { TopSpecies } from "~/lib/now.ts";

export function TopDetectionsCard({
	topSpecies,
}: {
	topSpecies: TopSpecies[];
}) {
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
				<ol className="mt-4 space-y-1">
					{topSpecies.map((species) => (
						<SpeciesRankRow
							key={species.comName}
							comName={species.comName}
							sciName={species.sciName}
							speciesSlug={species.speciesSlug}
							imageUrl={species.imageUrl}
							count={species.count}
							maximum={leader}
						/>
					))}
				</ol>
			)}
		</section>
	);
}
