import assert from "node:assert/strict";
import test from "node:test";

import {
	formatTimeAgo,
	freshnessFor,
	hourLabel,
	RECENTLY_HEARD_MS,
	SINGING_NOW_MS,
} from "./time-ago.ts";

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

test("labels very recent moments as just now", () => {
	assert.equal(formatTimeAgo(0), "just now");
	assert.equal(formatTimeAgo(9 * SECOND), "just now");
});

test("reads a clock running ahead of the viewer as just now", () => {
	assert.equal(formatTimeAgo(-30 * SECOND), "just now");
});

test("labels seconds, minutes, hours and days", () => {
	assert.equal(formatTimeAgo(10 * SECOND), "10 seconds ago");
	assert.equal(formatTimeAgo(2 * MINUTE), "2 minutes ago");
	assert.equal(formatTimeAgo(3 * HOUR), "3 hours ago");
	assert.equal(formatTimeAgo(2 * DAY), "2 days ago");
});

// The visit log reaches back over a species' whole history, so the scale has to
// keep reading well past the Today page's 24-hour window.
test("labels months and years for older visits", () => {
	assert.equal(formatTimeAgo(45 * DAY), "1 month ago");
	assert.equal(formatTimeAgo(3 * MONTH), "3 months ago");
	assert.equal(formatTimeAgo(YEAR), "1 year ago");
	assert.equal(formatTimeAgo(3 * YEAR), "3 years ago");
});

test("uses singular units for a count of one", () => {
	assert.equal(formatTimeAgo(MINUTE), "1 minute ago");
	assert.equal(formatTimeAgo(HOUR), "1 hour ago");
	assert.equal(formatTimeAgo(DAY), "1 day ago");
	assert.equal(formatTimeAgo(MONTH), "1 month ago");
	assert.equal(formatTimeAgo(YEAR), "1 year ago");
});

test("switches unit exactly at each boundary", () => {
	assert.equal(formatTimeAgo(MINUTE - SECOND), "59 seconds ago");
	assert.equal(formatTimeAgo(HOUR - SECOND), "59 minutes ago");
	assert.equal(formatTimeAgo(DAY - SECOND), "23 hours ago");
	assert.equal(formatTimeAgo(MONTH - SECOND), "29 days ago");
	assert.equal(formatTimeAgo(YEAR - SECOND), "12 months ago");
});

test("classifies freshness by the hero card's thresholds", () => {
	assert.equal(freshnessFor(0), "singing");
	assert.equal(freshnessFor(SINGING_NOW_MS - SECOND), "singing");
	assert.equal(freshnessFor(SINGING_NOW_MS), "recent");
	assert.equal(freshnessFor(RECENTLY_HEARD_MS - SECOND), "recent");
	assert.equal(freshnessFor(RECENTLY_HEARD_MS), "quiet");
	assert.equal(freshnessFor(5 * DAY), "quiet");
});

test("labels hours in twelve-hour time", () => {
	assert.equal(hourLabel(0), "12 AM");
	assert.equal(hourLabel(6), "6 AM");
	assert.equal(hourLabel(12), "12 PM");
	assert.equal(hourLabel(18), "6 PM");
});
