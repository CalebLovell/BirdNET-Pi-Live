import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SpeciesActions } from "~/components/species-actions.tsx";

test("species-list actions group Bird Call and eBird on the left", () => {
	const markup = renderToStaticMarkup(
		<SpeciesActions
			audioUrl="/audio/card.wav"
			ebirdUrl="https://ebird.org/species/brnowl"
			comName="Barn Owl"
		/>,
	);

	assert.match(markup, />Bird Call<\/button>/);
	assert.match(markup, /justify-start/);
	assert.match(markup, />eBird<\/a>/);
});

test("species-detail actions keep the eBird link", () => {
	const markup = renderToStaticMarkup(
		<SpeciesActions
			ebirdUrl="https://ebird.org/species/brnowl"
			comName="Barn Owl"
		/>,
	);

	assert.match(markup, /href="https:\/\/ebird\.org\/species\/brnowl"/);
	assert.match(markup, />eBird<\/a>/);
	assert.doesNotMatch(markup, /Bird Call/);
});
