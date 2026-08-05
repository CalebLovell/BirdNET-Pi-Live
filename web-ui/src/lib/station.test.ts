import assert from "node:assert/strict";
import { test } from "node:test";

import { formatStationTally } from "~/lib/station.ts";

test("formatStationTally pluralises calls but not species", () => {
	assert.equal(formatStationTally(31, 412), "31 species · 412 calls");
	// "species" is already its own plural, so only the call count inflects.
	assert.equal(formatStationTally(1, 1), "1 species · 1 call");
});

test("formatStationTally handles a station that has heard nothing", () => {
	assert.equal(formatStationTally(0, 0), "0 species · 0 calls");
});
