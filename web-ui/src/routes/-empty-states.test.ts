import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file: string) =>
	readFile(new URL(file, import.meta.url), "utf8");

/**
 * The rule this file guards: a page with nothing on it at all gets the card
 * treatment, and a card that is empty inside a populated page stays a quiet
 * line. Both come from `~/components/empty-state.tsx` -- nowhere should be
 * hand-rolling the paragraph any more.
 */

test("a station that has never recorded anything gets the page-level card", async () => {
	for (const file of [
		"./detections.tsx",
		"./timeline.tsx",
		"./learn.tsx",
		"./species.index.tsx",
	]) {
		const source = await read(file);
		assert.match(source, /<EmptyState/, `${file} should use EmptyState`);
		assert.match(
			source,
			/icon=\{Bird\}/,
			`${file}'s page-level empty should carry the bird`,
		);
	}
});

test("a quiet day keeps the page-level card it already had", async () => {
	const source = await read("./day.$date.tsx");
	assert.match(source, /<EmptyState icon=\{Bird\}/);
	assert.match(source, /No detections recorded on this day\./);
});

test("section-level empties stay quiet lines", async () => {
	const detections = await read("./detections.tsx");
	assert.match(
		detections,
		/<EmptyNote>No detections match these filters\.<\/EmptyNote>/,
	);

	const species = await read("./species.index.tsx");
	assert.match(species, /<EmptyNote>/);

	const timeline = await read("./timeline.tsx");
	assert.match(timeline, /<EmptyNote>\{emptyMessage\}<\/EmptyNote>/);
});

test("no route hand-rolls the empty paragraph any more", async () => {
	for (const file of [
		"./detections.tsx",
		"./timeline.tsx",
		"./learn.tsx",
		"./species.index.tsx",
		"./species.$comName.tsx",
		"./day.$date.tsx",
	]) {
		const source = await read(file);
		assert.doesNotMatch(
			source,
			/<p className="mt-4 text-muted-foreground text-sm">/,
			`${file} should use EmptyNote rather than its own paragraph`,
		);
	}
});
