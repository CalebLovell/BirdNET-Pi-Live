import assert from "node:assert/strict";
import test from "node:test";

import { loadStationHealth } from "./health.server.ts";

/**
 * This runs on Windows in development, against whatever database the checkout
 * happens to have. That is exactly the hostile case worth pinning: the figures
 * sit in the masthead above six working settings cards, and they must never be
 * the reason those do not render.
 */
test("reports every metric without throwing on a host that cannot answer", async () => {
	const health = await loadStationHealth();

	assert.deepEqual(
		health.metrics.map((metric) => metric.id),
		["disk", "database", "last-detection"],
	);

	for (const metric of health.metrics) {
		assert.ok(metric.label.length > 0, `${metric.id} needs a label`);
		// Never blank: an empty figure reads as a broken page rather than as a
		// reading that could not be taken.
		assert.ok(metric.value.length > 0, `${metric.id} needs a value`);
		assert.ok(
			["ok", "warn", "problem", "unknown"].includes(metric.level),
			`${metric.id} has an unknown level`,
		);
	}
});

test("health readings are cheap enough to poll", async () => {
	const started = Date.now();
	await loadStationHealth();
	// A statfs, a stat and one indexed row. Nothing here spawns a process, so
	// anything near a second means a probe is blocking on something it should
	// not be.
	assert.ok(
		Date.now() - started < 2_000,
		"a health check should not take seconds",
	);
});
