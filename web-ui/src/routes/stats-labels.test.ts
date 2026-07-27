import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const statsRouteSource = await readFile(
	new URL("./stats.tsx", import.meta.url),
	"utf8",
);

test("uses the requested stats page labels", () => {
	assert.match(statsRouteSource, /label="Unique species"/);
	assert.match(statsRouteSource, /aria-label="Detections by hour"/);
	assert.match(
		statsRouteSource,
		/<div className="island-kicker">Detections by hour<\/div>/,
	);
	assert.doesNotMatch(statsRouteSource, /Species detected/);
	assert.doesNotMatch(statsRouteSource, /Activity by hour of day/);
});
