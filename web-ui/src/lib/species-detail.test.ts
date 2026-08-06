import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("an unreadable catalog degrades to unknown, not to unavailable", async () => {
	const source = await readFile(
		new URL("./species-detail.ts", import.meta.url),
		"utf8",
	);
	// The catalog read is wrapped: a missing model directory must not turn an
	// unknown species slug into a station-wide failure.
	assert.match(
		source,
		/try\s*\{[\s\S]*?loadInstalledSpeciesCatalog\(\)[\s\S]*?\}\s*catch\s*\{[\s\S]*?return null;[\s\S]*?\}/,
	);
});

test("the handler distinguishes all three outcomes", async () => {
	const source = await readFile(
		new URL("./species-detail.ts", import.meta.url),
		"utf8",
	);
	assert.match(source, /status:\s*"detected"/);
	assert.match(source, /status:\s*"undetected"/);
	assert.match(source, /status:\s*"unknown"/);
});
