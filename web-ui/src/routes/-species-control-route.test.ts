import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("species control route loads data, adapts mutations, and invalidates commits", async () => {
	const source = await readFile(
		new URL("./species-control.tsx", import.meta.url),
		"utf8",
	);
	assert.match(source, /createFileRoute\("\/species-control"\)/);
	assert.match(source, /loader:\s*\(\)\s*=>\s*getSpeciesControlPage/);
	assert.match(source, /<SpeciesControlPage/);
	assert.match(source, /useServerFn\(saveSpeciesControl\)/);
	assert.match(source, /useServerFn\(getSpeciesRangePreview\)/);
	assert.match(source, /useServerFn\(getSpeciesHistoryDeletePreview\)/);
	assert.match(source, /useServerFn\(deleteSpeciesHistoryFn\)/);
	assert.match(source, /router\.invalidate\(\)/);
	assert.match(source, /Species control is unavailable/);
});

test("navigation places Control immediately after Species", async () => {
	const source = await readFile(
		new URL("../components/Header.tsx", import.meta.url),
		"utf8",
	);
	const species = source.indexOf('to="/species"');
	const control = source.indexOf('to="/species-control"');
	const detections = source.indexOf('to="/detections"');
	assert.ok(species >= 0 && control > species && detections > control);
	assert.match(source.slice(control, detections), />\s*Control\s*</);
});
