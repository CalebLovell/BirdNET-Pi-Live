import assert from "node:assert/strict";
import test from "node:test";

import { shortDateLabel } from "./migration-data.ts";

test("formats a date as a compact month and day", () => {
	assert.equal(shortDateLabel("2026-07-11"), "Jul 11");
});

test("formats a date the same either side of a UTC day boundary", () => {
	// Parsed at UTC midnight rather than local: a local parse renders the stored
	// date as the previous day for anyone west of Greenwich.
	assert.equal(shortDateLabel("2026-01-01"), "Jan 1");
});

test("falls back to the raw value for an unparseable date", () => {
	assert.equal(shortDateLabel("garbage"), "garbage");
});
