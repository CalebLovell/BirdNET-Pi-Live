import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the day route loads through the range check, not a bare format check", async () => {
	const source = await readFile(
		new URL("./day.$date.tsx", import.meta.url),
		"utf8",
	);
	assert.match(source, /getDayPage\(\{\s*data:\s*params\.date\s*\}\)/);
	assert.doesNotMatch(source, /isDayId\(params\.date\)\s*\?\s*getDayReview/);
});

test("each out-of-range verdict gets its own card, and a quiet day does not", async () => {
	const source = await readFile(
		new URL("./day.$date.tsx", import.meta.url),
		"utf8",
	);
	assert.match(source, /case "malformed"/);
	assert.match(source, /case "future"/);
	assert.match(source, /case "before-station"/);
	assert.match(source, /<StatusPage/);
	// The genuine empty state is untouched.
	assert.match(source, /<QuietDay day=\{day\} \/>/);
});
