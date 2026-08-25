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

import { TodaysStoryCard } from "~/components/now/todays-story-card.tsx";
import type { StoryLine } from "~/lib/story-data.ts";

// Every bird the story names links to its species page, and <Link> needs a
// router in context to resolve one -- so the card renders inside a memory
// router whose only route is the card itself.
async function renderCard(lines: StoryLine[]) {
	const rootRoute = createRootRoute();
	const indexRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/",
		component: () => <TodaysStoryCard lines={lines} />,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([indexRoute]),
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});
	await router.load();
	return renderToStaticMarkup(<RouterProvider router={router} />);
}

const volumeLine: StoryLine = {
	tone: "quiet",
	headline: "Quieter than usual",
	detail: "Activity is 60% below your two-week average.",
	species: [],
	moreCount: 0,
};

const speciesLine: StoryLine = {
	tone: "rare",
	headline: "Rare visitors",
	detail: "Barely ever heard here — worth a listen in Review.",
	species: [
		{
			comName: "Wryneck",
			sciName: "Jynx torquilla",
			speciesSlug: "wryneck",
			imageUrl: "/illustrations/wryneck.png",
			note: "2 records ever",
		},
	],
	moreCount: 3,
};

test("a station with nothing recorded gets no card at all", async () => {
	// Not an empty card: the hero above already says the station is silent, and
	// a second box repeating it just doubles the emptiness.
	assert.equal(await renderCard([]), "");
});

test("a line with no birds is just the sentence", async () => {
	const markup = await renderCard([volumeLine]);

	assert.match(markup, /Quieter than usual/);
	assert.match(markup, /60% below your two-week average/);
	assert.doesNotMatch(markup, /<img/);
});

test("a named bird arrives as a bird, not as text in a sentence", async () => {
	const markup = await renderCard([speciesLine]);

	assert.match(markup, /src="\/illustrations\/wryneck.png"/);
	assert.match(markup, /href="\/species\/wryneck"/);
	assert.match(markup, /2 records ever/);
});

test("birds past the listed few are counted rather than dropped", async () => {
	assert.match(await renderCard([speciesLine]), /and 3 more/);
});

test("each rule gets its own icon", async () => {
	assert.match(await renderCard([volumeLine]), /lucide-cloud/);
	assert.match(await renderCard([speciesLine]), /lucide-search/);
});
