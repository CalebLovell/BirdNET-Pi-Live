import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CircleAlert } from "lucide-react";

import { LockedPage } from "~/components/auth/locked-page.tsx";
import {
	SPECIES_CONTROL_PAGE_DESCRIPTION,
	SPECIES_CONTROL_PAGE_TITLE,
	SpeciesControlPage,
} from "~/components/species-control/species-control-page.tsx";
import { pageTitle } from "~/lib/page-title.ts";
import {
	getSpeciesControlPage,
	saveSpeciesControl,
} from "~/lib/species-control.ts";
import { normalizeSpeciesControlWorkspaceSearch } from "~/lib/species-control-workspace.ts";

export const Route = createFileRoute("/species-control")({
	head: () => ({ meta: [{ title: pageTitle("Species control") }] }),
	validateSearch: normalizeSpeciesControlWorkspaceSearch,
	loader: async ({ context }) =>
		context.auth.unlocked ? await getSpeciesControlPage() : null,
	component: SpeciesControlRoute,
	errorComponent: SpeciesControlUnavailable,
});

function SpeciesControlRoute() {
	const initialData = Route.useLoaderData();
	if (!initialData)
		return (
			<LockedPage
				title={SPECIES_CONTROL_PAGE_TITLE}
				description={SPECIES_CONTROL_PAGE_DESCRIPTION}
			/>
		);
	return <SpeciesControlContent initialData={initialData} />;
}

function SpeciesControlContent({
	initialData,
}: {
	initialData: NonNullable<ReturnType<typeof Route.useLoaderData>>;
}) {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const save = useServerFn(saveSpeciesControl);
	const router = useRouter();

	return (
		<SpeciesControlPage
			initialData={initialData}
			search={search}
			onSearchChange={(nextSearch) =>
				navigate({ search: nextSearch, replace: true })
			}
			onSave={(data) => save({ data })}
			onCommitted={() => router.invalidate()}
		/>
	);
}

function SpeciesControlUnavailable() {
	return (
		<div className="page-wrap py-4">
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
		</div>
	);
}
