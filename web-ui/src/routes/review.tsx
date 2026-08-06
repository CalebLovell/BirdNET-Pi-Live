import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CircleAlert, Feather, ListChecks } from "lucide-react";
import { useState } from "react";
import { UnlockGate } from "~/components/auth/unlock-gate.tsx";
import { PageHeaderCard } from "~/components/page-header-card.tsx";
import { ReviewQueueSettings } from "~/components/review/review-queue-settings.tsx";
import { ReviewWorkflow } from "~/components/review/review-workflow.tsx";
import { CONFIDENT_MIN, formatConfidence } from "~/lib/confidence.ts";
import { pageTitle } from "~/lib/page-title.ts";
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
import { saveReviewSettingsFn } from "~/lib/settings.ts";

export const Route = createFileRoute("/review")({
	head: () => ({ meta: [{ title: pageTitle("Review") }] }),
	validateSearch: normalizeReviewSearch,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		if (!context.auth.unlocked) return null;
		return {
			page: await getReviewPage({ data: deps }),
			species: await getReviewSpecies(),
		};
	},
	component: Review,
});

function Review() {
	const loaded = Route.useLoaderData();
	if (!loaded) return <UnlockGate title="Review" />;
	return <ReviewContent loaded={loaded} />;
}

function ReviewContent({
	loaded,
}: {
	loaded: NonNullable<ReturnType<typeof Route.useLoaderData>>;
}) {
	const { page, species } = loaded;
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const router = useRouter();
	const correct = useServerFn(confirmReviewDetection),
		recategorize = useServerFn(recategorizeReviewDetection),
		remove = useServerFn(deleteReviewDetection),
		saveQueueSettings = useServerFn(saveReviewSettingsFn);
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
				description={`Species the station has heard fewer than ${page.rareSpeciesMax} times, on recordings BirdNET scored below ${formatConfidence(CONFIDENT_MIN)}.`}
				stats={[
					{
						label: "Recordings to review",
						value: page.total,
						icon: ListChecks,
					},
					{
						label: "Species",
						value: page.speciesTotal,
						icon: Feather,
					},
				]}
				action={
					<ReviewQueueSettings
						rareSpeciesMax={page.rareSpeciesMax}
						onSave={async (rareSpeciesMax) => {
							await saveQueueSettings({ data: { rareSpeciesMax } });
							// The threshold decides the queue, so the page has to be
							// refetched before the new number means anything on screen.
							await router.invalidate();
						}}
					/>
				}
			/>
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
