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

import type { SpeciesControlPageData } from "~/lib/species-control-data.ts";
import { SpeciesControlPage } from "./species-control-page.tsx";

const data: SpeciesControlPageData = {
	revision: "fixture-revision",
	customMode: false,
	listFiles: { custom: true, excluded: true, whitelisted: true },
	unresolved: {
		custom: [],
		excluded: ["Old species_Old name"],
		whitelisted: [],
	},
	rows: [
		{
			sciName: "Canis latrans",
			comName: "Coyote",
			custom: false,
			excluded: false,
			whitelisted: true,
			history: {
				detections: 4,
				maxConfidence: 0.91,
				lastSeen: "2026-07-30T23:00",
				recordings: 3,
			},
		},
		{
			sciName: "Sciurus carolinensis",
			comName: "Eastern Gray Squirrel",
			custom: false,
			excluded: true,
			whitelisted: false,
			history: {
				detections: 0,
				maxConfidence: null,
				lastSeen: null,
				recordings: 0,
			},
		},
	],
};

async function renderPage() {
	const rootRoute = createRootRoute();
	const indexRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/",
		component: () => (
			<SpeciesControlPage
				initialData={data}
				search={{ page: 1, sort: "species", direction: "asc" }}
				onSearchChange={() => {}}
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

test("renders the complete species policy workspace", async () => {
	const markup = await renderPage();
	assert.match(markup, />Species control</);
	assert.doesNotMatch(markup, /Detection mode/);
	assert.match(markup, /aria-label="Search installed species"/);
	assert.match(markup, />Installed species</);
	for (const heading of ["Species", "Scientific name", "Count", "Status"]) {
		assert.match(markup, new RegExp(`>${heading}<`));
	}
	assert.match(markup, />Import lists</);
	assert.match(markup, />Export lists</);
	assert.match(markup, />Reset lists</);
	assert.match(markup, /Old species_Old name/);
});

test("keeps page tools outside the table and bulk status in its header", async () => {
	const markup = await renderPage();
	const toolbarStart = markup.indexOf('data-layout="species-control-toolbar"');
	const installedStart = markup.indexOf('aria-label="Installed species"');
	assert.ok(toolbarStart >= 0, "expected the exterior Species control toolbar");
	assert.ok(installedStart > toolbarStart, "expected toolbar before the card");

	const toolbar = markup.slice(toolbarStart, installedStart);
	let previousIndex = -1;
	for (const label of [
		'aria-label="Search installed species"',
		">Import lists<",
		">Export lists<",
		">Reset lists<",
	]) {
		const index = toolbar.indexOf(label);
		assert.ok(index > previousIndex, `expected ${label} in toolbar order`);
		previousIndex = index;
	}
	assert.equal(toolbar.match(/data-size="default"/g)?.length, 3);
	assert.equal(toolbar.match(/h-9/g)?.length, 4);

	const installed = markup.slice(installedStart);
	assert.match(installed, /data-layout="installed-species-header"/);
	assert.match(installed, />Installed species</);
	assert.equal(installed.match(/<select/g)?.length, 1);
	assert.match(installed, /<select[^>]*aria-label="Sort species by"/);
	assert.doesNotMatch(installed, />Import lists</);
	assert.doesNotMatch(installed, />Export lists</);
	assert.doesNotMatch(installed, />Reset lists</);
	assert.doesNotMatch(installed, /border-\[var\(--line\)\] border-y py-2/);
});

test("status is the only verdict the table states", async () => {
	const markup = await renderPage();
	assert.match(markup, />Always detect</);
	assert.match(markup, />Never detect</);
	assert.doesNotMatch(markup, />Policy</);
	assert.doesNotMatch(markup, />Effective</);
	// The summary cards are gone; their captions are the cheapest proof.
	for (const caption of [
		"restricted scope",
		"never detect",
		"ignore range",
		"unmatched entries",
		"not saved",
	]) {
		assert.doesNotMatch(markup, new RegExp(caption));
	}
});

test("offers four explicit bulk status actions", async () => {
	const markup = await renderPage();
	for (const [status, borderClass] of [
		["Automatic", "border-[var(--line)]"],
		["Custom", "border-[color-mix(in_oklab,var(--sage)_65%,var(--line))]"],
		[
			"Always detect",
			"border-[color-mix(in_oklab,var(--sand)_65%,var(--line))]",
		],
		[
			"Never detect",
			"border-[color-mix(in_oklab,var(--clay)_45%,var(--line))]",
		],
	] as const) {
		const button = markup.match(
			new RegExp(
				`<button(?=[^>]*aria-label="Set selected species to ${status}")(?=[^>]*disabled="")[^>]*>`,
			),
		)?.[0];
		assert.ok(button, `expected the ${status} bulk action`);
		assert.match(button, /data-variant="outline"/);
		assert.ok(
			button.includes(borderClass),
			`expected the ${status} action to use its tinted border`,
		);
	}
	assert.doesNotMatch(
		markup,
		/<select[^>]*aria-label="Set selected species status"/,
	);
});

test("the four statuses are explained on demand rather than above the table", async () => {
	const markup = await renderPage();
	assert.match(markup, /aria-label="About Installed species"/);
	assert.doesNotMatch(markup, /Normal mode|Custom mode|Detection mode/);
});

test("detection history is no longer deletable from this page", async () => {
	const markup = await renderPage();
	assert.doesNotMatch(markup, />Delete history</);
	assert.doesNotMatch(markup, />History</);
	assert.doesNotMatch(markup, />Manage</);
});

test("does not render staged save controls", async () => {
	const markup = await renderPage();
	assert.doesNotMatch(markup, />Review and save</);
	assert.doesNotMatch(markup, /pending change/);
	assert.doesNotMatch(markup, /role="alertdialog"/);
});
