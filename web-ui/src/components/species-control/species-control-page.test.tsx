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

test("renders the complete species policy workspace", () => {
	const markup = renderToStaticMarkup(
		<SpeciesControlPage initialData={data} />,
	);
	assert.match(markup, />Species control</);
	assert.match(markup, /aria-label="Detection scope"/);
	assert.match(markup, /aria-label="Search installed species"/);
	assert.match(markup, />Installed species</);
	for (const heading of ["Species", "Count", "Policy"]) {
		assert.match(markup, new RegExp(`>${heading}<`));
	}
	assert.match(markup, />Import lists</);
	assert.match(markup, />Export lists</);
	assert.match(markup, />Reset lists</);
	assert.match(markup, /Old species_Old name/);
});

test("policy is the only verdict the table states", () => {
	const markup = renderToStaticMarkup(
		<SpeciesControlPage initialData={data} />,
	);
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

// The scope switch itself always carries a "Custom" button, so these assert on
// the controls the switch governs rather than on the word appearing anywhere.
// The scopes are described in a tooltip, which renders nothing until opened.
test("normal scope hides every Custom control, since the list has no effect", () => {
	const markup = renderToStaticMarkup(
		<SpeciesControlPage initialData={data} />,
	);
	assert.doesNotMatch(markup, /in Custom list/); // row checkbox
	assert.doesNotMatch(markup, />Add to Custom</); // bulk action
});

test("custom scope restores the Custom column", () => {
	const markup = renderToStaticMarkup(
		<SpeciesControlPage
			initialData={{
				...data,
				customMode: true,
				rows: data.rows.map((row) =>
					row.sciName === "Canis latrans" ? { ...row, custom: true } : row,
				),
			}}
		/>,
	);
	assert.match(markup, /in Custom list/);
	assert.match(markup, />Add to Custom</);
});

test("custom scope with nothing ticked warns on the page, not in the tooltip", () => {
	const markup = renderToStaticMarkup(
		<SpeciesControlPage initialData={{ ...data, customMode: true }} />,
	);
	assert.match(markup, /BirdNET keeps behaving as Normal/);
});

test("the scopes are explained on demand rather than above the table", () => {
	const markup = renderToStaticMarkup(
		<SpeciesControlPage initialData={data} />,
	);
	assert.match(markup, /aria-label="About Installed species"/);
	// Prose that used to sit between the search row and the table.
	assert.doesNotMatch(markup, /Every installed species can be detected/);
	assert.doesNotMatch(markup, /Exclusions still win/);
});

test("detection history is no longer deletable from this page", () => {
	const markup = renderToStaticMarkup(
		<SpeciesControlPage initialData={data} />,
	);
	assert.doesNotMatch(markup, />Delete history</);
	assert.doesNotMatch(markup, />History</);
	assert.doesNotMatch(markup, />Manage</);
});

test("does not show a save bar until a policy change is staged", () => {
	const markup = renderToStaticMarkup(
		<SpeciesControlPage initialData={data} />,
	);
	assert.doesNotMatch(markup, />Review and save</);
	assert.doesNotMatch(markup, /role="alertdialog"/);
});
