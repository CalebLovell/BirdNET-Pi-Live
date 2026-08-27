import assert from "node:assert/strict";
import test from "node:test";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";

import {
	SpeciesGrid,
	type SpeciesGridItem,
} from "~/components/species-grid.tsx";

async function renderGrid(
	species: SpeciesGridItem[],
	newLabel: string | null,
) {
	const rootRoute = createRootRoute();
	const indexRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/",
		component: () => (
			<SpeciesGrid
				species={species}
				newLabel={newLabel}
				emptyMessage="Nothing heard in this window."
			/>
		),
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([indexRoute]),
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});
	await router.load();
	return renderToStaticMarkup(<RouterProvider router={router} />);
}

const robin: SpeciesGridItem = {
	comName: "European Robin",
	sciName: "Erithacus rubecula",
	imageUrl: "/illustrations/robin.png",
	count: 128,
	averageConfidence: 0.83,
	isNew: false,
	isRare: false,
};

test("a species row shows its name, count and confidence", async () => {
	const markup = await renderGrid([robin], "this week");
	assert.match(markup, /European Robin/);
	assert.match(markup, /href="\/species\/european-robin"/);
	assert.match(markup, /128/);
	assert.match(markup, /83%/);
	// No chips on an ordinary resident.
	assert.doesNotMatch(markup, /lucide-sparkles/);
	assert.doesNotMatch(markup, /lucide-gem/);
});

test("a new species gets a New chip when the window is named", async () => {
	const markup = await renderGrid([{ ...robin, isNew: true }], "this week");
	assert.match(markup, /lucide-sparkles/);
	assert.match(markup, /New/);
});

test("a null newLabel hides the New chip", async () => {
	const markup = await renderGrid([{ ...robin, isNew: true }], null);
	assert.doesNotMatch(markup, /lucide-sparkles/);
});

test("a rare visitor gets a Rare chip with the gem icon", async () => {
	const markup = await renderGrid([{ ...robin, isRare: true }], "this week");
	assert.match(markup, /lucide-gem/);
	assert.match(markup, /Rare/);
});

test("an empty grid shows its empty note", async () => {
	const markup = await renderGrid([], "this week");
	assert.match(markup, /Nothing heard in this window/);
});
