import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CircleAlert } from "lucide-react";

import { SpeciesControlPage } from "~/components/species-control/species-control-page.tsx";
import { pageTitle } from "~/lib/page-title.ts";
import {
	deleteSpeciesHistoryFn,
	getSpeciesControlPage,
	getSpeciesHistoryDeletePreview,
	getSpeciesRangePreview,
	saveSpeciesControl,
} from "~/lib/species-control.ts";

export const Route = createFileRoute("/species-control")({
	head: () => ({ meta: [{ title: pageTitle("Species control") }] }),
	loader: () => getSpeciesControlPage(),
	component: SpeciesControlRoute,
	errorComponent: SpeciesControlUnavailable,
});

function SpeciesControlRoute() {
	const initialData = Route.useLoaderData();
	const save = useServerFn(saveSpeciesControl);
	const preview = useServerFn(getSpeciesRangePreview);
	const historyPreview = useServerFn(getSpeciesHistoryDeletePreview);
	const deleteHistory = useServerFn(deleteSpeciesHistoryFn);
	const router = useRouter();

	return (
		<SpeciesControlPage
			initialData={initialData}
			onSave={(data) => save({ data })}
			onPreview={() => preview({})}
			onHistoryPreview={(sciName) => historyPreview({ data: { sciName } })}
			onHistoryDelete={(data) => deleteHistory({ data })}
			onCommitted={() => router.invalidate()}
		/>
	);
}

function SpeciesControlUnavailable() {
	return (
		<main className="page-wrap py-4">
			<section className="feature-card rounded-md p-5">
				<div className="flex items-start gap-3">
					<CircleAlert
						aria-hidden="true"
						className="mt-0.5 size-5 text-destructive"
					/>
					<div>
						<h1 className="display-title font-semibold text-xl">
							Species control is unavailable
						</h1>
						<p className="mt-2 max-w-2xl text-muted-foreground text-sm leading-relaxed">
							The installed model catalog or species-list directory could not be
							read. Check the BirdNET model and service permissions, then reload
							this page.
						</p>
					</div>
				</div>
			</section>
		</main>
	);
}
