import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("species control route loads data, adapts mutations, and invalidates commits", async () => {
	const source = await readFile(
		new URL("./species-control.tsx", import.meta.url),
		"utf8",
	);
	assert.match(source, /createFileRoute\("\/species-control"\)/);
	assert.match(
		source,
		/loader:\s*async\s*\(\{\s*context\s*\}\)\s*=>\s*\n?\s*context\.auth\.unlocked\s*\?\s*await getSpeciesControlPage\(\)\s*:\s*null/,
	);
	assert.match(
		source,
		/validateSearch:\s*normalizeSpeciesControlWorkspaceSearch/,
	);
	assert.match(source, /Route\.useSearch\(\)/);
	assert.match(source, /Route\.useNavigate\(\)/);
	assert.match(source, /search=\{search\}/);
	assert.match(source, /replace:\s*true/);
	assert.match(source, /<SpeciesControlPage/);
	assert.match(source, /useServerFn\(saveSpeciesControl\)/);
	assert.match(source, /router\.invalidate\(\)/);
	assert.match(source, /Species control is unavailable/);
});

test("navigation groups Control with the other locked pages", async () => {
	const source = await readFile(
		new URL("../components/sidebar/sidebar-nav.tsx", import.meta.url),
		"utf8",
	);
	// Control sits in the second group, after every page a visitor can open,
	// and between Review and Settings -- the three that carry a lock.
	const explore = source.indexOf("Explore");
	const manage = source.indexOf("Manage");
	const review = source.indexOf('to="/review"');
	const control = source.indexOf('to="/species-control"');
	const settings = source.indexOf('to="/settings"');
	const species = source.indexOf('to="/species"');
	const detections = source.indexOf('to="/detections"');

	assert.ok(explore >= 0 && manage > explore, "both group labels are present");
	assert.ok(
		species > explore && detections > species && detections < manage,
		"the open pages stay in the first group",
	);
	assert.ok(
		review > manage && control > review && settings > control,
		"the locked pages run Review, Control, Settings",
	);
	assert.match(source.slice(control, settings), />\s*Control\s*\{lock\}\s*</);
});
