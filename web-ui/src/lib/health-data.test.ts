import assert from "node:assert/strict";
import test from "node:test";

import {
	diskLevel,
	formatBytes,
	formatPercent,
	lastDetectionLevel,
} from "./health-data.ts";

test("disk severity is measured against this station's own purge threshold", () => {
	// The default station acts at 95%.
	assert.equal(diskLevel(46.6, 95), "ok");
	assert.equal(diskLevel(84.9, 95), "ok");
	assert.equal(diskLevel(85, 95), "warn");
	assert.equal(diskLevel(94.9, 95), "warn");
	assert.equal(diskLevel(95, 95), "problem");

	// A station configured to act sooner turns amber and red sooner, on the
	// same disk -- which is the whole point of reading the setting.
	assert.equal(diskLevel(46.6, 50), "warn");
	assert.equal(diskLevel(60, 50), "problem");
});

test("silence is only suspicious after a day and wrong after three", () => {
	const hour = 60 * 60 * 1000;
	assert.equal(lastDetectionLevel(5 * hour), "ok");
	// A station can legitimately hear nothing overnight.
	assert.equal(lastDetectionLevel(23 * hour), "ok");
	assert.equal(lastDetectionLevel(25 * hour), "warn");
	assert.equal(lastDetectionLevel(80 * hour), "problem");
	// Never detected anything: a new station, not a broken one.
	assert.equal(lastDetectionLevel(null), "unknown");
});

test("sizes read the way a person would say them", () => {
	assert.equal(formatBytes(0), "0 B");
	assert.equal(formatBytes(900), "900 B");
	assert.equal(formatBytes(2048), "2 KB");
	assert.equal(formatBytes(3.08 * 1024 * 1024), "3.08 MB");
	assert.equal(formatBytes(5 * 1024 ** 3), "5.00 GB");
	assert.equal(formatBytes(Number.NaN), "—");
	// Bare, because "used" rides beside the figure as its detail.
	assert.equal(formatPercent(46.63), "46.6%");
});
