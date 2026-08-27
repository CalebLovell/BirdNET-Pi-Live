import assert from "node:assert/strict";
import test from "node:test";

import { formatBytes, formatPercent } from "./health-data.ts";

test("sizes read the way a person would say them", () => {
	assert.equal(formatBytes(0), "0 B");
	assert.equal(formatBytes(900), "900 B");
	assert.equal(formatBytes(2048), "2 KB");
	assert.equal(formatBytes(3.08 * 1024 * 1024), "3.08 MB");
	assert.equal(formatBytes(5 * 1024 ** 3), "5.00 GB");
	assert.equal(formatBytes(Number.NaN), "—");
	assert.equal(formatPercent(46.63), "46.6%");
});
