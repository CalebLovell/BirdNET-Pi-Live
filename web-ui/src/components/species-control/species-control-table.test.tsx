import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SpeciesControlTable } from "./species-control-table.tsx";

test("renders Installed species with the detections table language", () => {
	const markup = renderToStaticMarkup(
		<SpeciesControlTable
			rows={[
				{
					sciName: "Canis latrans",
					comName: "Coyote",
					custom: false,
					excluded: false,
					whitelisted: false,
					policy: "automatic",
					history: {
						detections: 4,
						maxConfidence: 0.91,
						lastSeen: "2026-07-30T23:00",
						recordings: 3,
					},
				},
			]}
			page={1}
			pageCount={1}
			total={1}
			selected={new Set()}
			sort="species"
			reverse={false}
			onSortChange={() => {}}
			onSelectedChange={() => {}}
			onCustomChange={() => {}}
			onPolicyChange={() => {}}
			onPageChange={() => {}}
			showCustom={false}
		/>,
	);

	for (const slot of [
		"table",
		"table-header",
		"table-body",
		"table-row",
		"table-head",
		"table-cell",
	]) {
		assert.match(markup, new RegExp(`data-slot="${slot}"`));
	}
	assert.equal(markup.match(/data-slot="table-head"/g)?.length, 5);
	assert.equal(markup.match(/data-slot="table-cell"/g)?.length, 5);
	assert.equal(markup.match(/font-semibold/g)?.length, 5);
	for (const heading of ["Species", "Scientific name", "Count", "Policy"]) {
		assert.match(markup, new RegExp(`>${heading}(?:<|$)`));
	}
	assert.match(markup, />Coyote</);
	assert.match(markup, />Canis latrans</);
	assert.match(markup, /hover:bg-muted\/50/);
	assert.match(markup, /opacity-35/);
});
