import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const statsRouteSource = await readFile(
	new URL("./stats.tsx", import.meta.url),
	"utf8",
);
const hourlyCardSource = await readFile(
	new URL("../components/detections-by-hour-card.tsx", import.meta.url),
	"utf8",
);

test("uses the requested stats page labels", () => {
	assert.match(statsRouteSource, /label: "Unique species"/);
	assert.match(hourlyCardSource, /aria-label="Detections by hour"/);
	assert.match(hourlyCardSource, />Detections by hour</);
	assert.doesNotMatch(statsRouteSource, /Species detected/);
	assert.doesNotMatch(hourlyCardSource, /Activity by hour of day/);
});
