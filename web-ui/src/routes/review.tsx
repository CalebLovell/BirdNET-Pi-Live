import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CircleAlert, ListChecks, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { PageHeaderCard } from "~/components/page-header-card.tsx";
import { ReviewWorkflow } from "~/components/review/review-workflow.tsx";
import { Button } from "~/components/ui/button.tsx";
import {
	confirmReviewDetection,
	deleteReviewDetection,
	getReviewPage,
	getReviewSpecies,
	recategorizeReviewDetection,
} from "~/lib/review.ts";
import {
	normalizeReviewSearch,
	type SpeciesOption,
} from "~/lib/review-data.ts";

export const Route = createFileRoute("/review")({
	validateSearch: normalizeReviewSearch,
	loaderDeps: ({ search }) => search,
	loader: async ({ deps }) => ({
		page: await getReviewPage({ data: deps }),
		species: await getReviewSpecies(),
	}),
	component: Review,
});

function Review() {
	const { page, species } = Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const router = useRouter();
	const correct = useServerFn(confirmReviewDetection),
		recategorize = useServerFn(recategorizeReviewDetection),
		remove = useServerFn(deleteReviewDetection);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	async function run(work: () => Promise<unknown>) {
		setBusy(true);
		setError(null);
		try {
			await work();
			await router.invalidate();
		} catch {
			setError(
				"The detection could not be changed. Check the recording and try again.",
			);
		} finally {
			setBusy(false);
		}
	}
	return (
		<div className="page-wrap space-y-4 py-4">
			<PageHeaderCard
				title="Review detections"
				description="Listen closely, compare the call, then correct the station’s record."
				stats={[
					{ label: "Rare species", value: page.rareTotal, icon: ListChecks },
					{
						label: "Low confidence",
						value: page.lowConfidenceTotal,
						icon: ShieldCheck,
					},
				]}
			/>
			<div className="flex gap-2" role="tablist" aria-label="Review queue">
				<Button
					role="tab"
					aria-selected={search.queue === "rare"}
					variant={search.queue === "rare" ? "default" : "outline"}
					onClick={() => navigate({ search: { queue: "rare", limit: 20 } })}
				>
					Rare species
				</Button>
				<Button
					role="tab"
					aria-selected={search.queue === "low-confidence"}
					variant={search.queue === "low-confidence" ? "default" : "outline"}
					onClick={() =>
						navigate({ search: { queue: "low-confidence", limit: 20 } })
					}
				>
					Low confidence
				</Button>
			</div>
			{error ? (
				<p className="flex items-center gap-2 text-destructive text-sm">
					<CircleAlert className="size-4" />
					{error}
				</p>
			) : null}
			<ReviewWorkflow
				page={page}
				species={species}
				busy={busy}
				onCorrect={(rowId) => run(() => correct({ data: { rowId } }))}
				onRecategorize={(rowId: number, item: SpeciesOption) =>
					run(() => recategorize({ data: { rowId, ...item } }))
				}
				onDelete={(rowId) => run(() => remove({ data: { rowId } }))}
				onLoadMore={() =>
					navigate({
						search: { ...search, limit: Math.min(200, search.limit + 20) },
					})
				}
			/>
		</div>
	);
}
