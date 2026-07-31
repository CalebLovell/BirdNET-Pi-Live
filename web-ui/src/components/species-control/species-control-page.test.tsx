import assert from "node:assert/strict";
import test from "node:test";
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
			geographicallyEligible: null,
			probability: null,
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
			geographicallyEligible: null,
			probability: null,
			history: {
				detections: 0,
				maxConfidence: null,
				lastSeen: null,
				recordings: 0,
			},
		},
	],
};

test("renders the complete species policy workspace", () => {
	const markup = renderToStaticMarkup(
		<SpeciesControlPage initialData={data} />,
	);
	assert.match(markup, />Species control</);
	for (const label of [
		"Custom",
		"Excluded",
		"Always detect",
		"Eligible now",
		"Needs attention",
		"Pending changes",
	]) {
		assert.match(markup, new RegExp(`>${label}<`));
	}
	assert.match(markup, /Normal detection scope/);
	assert.match(markup, /Search installed species/);
	assert.match(markup, />Show</);
	for (const heading of [
		"Species",
		"History",
		"Custom",
		"Policy",
		"Effective",
		"Manage",
	]) {
		assert.match(markup, new RegExp(`>${heading}<`));
	}
	assert.match(markup, />Import lists</);
	assert.match(markup, />Export lists</);
	assert.match(markup, />Reset lists</);
	assert.match(markup, />Check current range</);
	assert.match(markup, />Delete history</);
	assert.match(markup, /Old species_Old name/);
});

test("does not show a save bar until a policy change is staged", () => {
	const markup = renderToStaticMarkup(
		<SpeciesControlPage initialData={data} />,
	);
	assert.doesNotMatch(markup, />Review and save</);
	assert.doesNotMatch(markup, /role="alertdialog"/);
});
