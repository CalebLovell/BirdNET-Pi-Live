import assert from "node:assert/strict";
import test from "node:test";

import { classifyDay } from "~/lib/day-range.ts";

const TODAY = "2026-08-06";
const FIRST = "2024-03-04";

test("a date that is not a date is malformed", () => {
	assert.equal(classifyDay("banana", TODAY, FIRST), "malformed");
	assert.equal(classifyDay("2026-8-6", TODAY, FIRST), "malformed");
	assert.equal(classifyDay("2026-02-30", TODAY, FIRST), "malformed");
});

test("tomorrow has not happened yet", () => {
	assert.equal(classifyDay("2026-08-07", TODAY, FIRST), "future");
	assert.equal(classifyDay("2099-01-01", TODAY, FIRST), "future");
});

test("today itself is in range", () => {
	assert.equal(classifyDay(TODAY, TODAY, FIRST), "in-range");
});

test("a date before the station's first recording is out of range", () => {
	assert.equal(classifyDay("2024-03-03", TODAY, FIRST), "before-station");
	assert.equal(classifyDay("1901-03-02", TODAY, FIRST), "before-station");
});

test("the station's first recorded day is itself in range", () => {
	assert.equal(classifyDay(FIRST, TODAY, FIRST), "in-range");
});

test("a quiet day between the first recording and today is still in range", () => {
	assert.equal(classifyDay("2025-11-20", TODAY, FIRST), "in-range");
});

test("a station with no recordings at all rejects only the future", () => {
	assert.equal(classifyDay("1990-01-01", TODAY, null), "in-range");
	assert.equal(classifyDay("2099-01-01", TODAY, null), "future");
});
