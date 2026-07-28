import assert from "node:assert/strict";
import test from "node:test";
import {
	normalizeReviewSearch,
	parseSpeciesCatalog,
	recategorizedFileName,
} from "./review-data.ts";

test("normalizes review queue and batch size", () => {
	assert.deepEqual(normalizeReviewSearch({ queue: "rare", limit: 40 }), {
		queue: "rare",
		limit: 40,
	});
	assert.deepEqual(normalizeReviewSearch({ queue: "unknown", limit: 999 }), {
		queue: "rare",
		limit: 20,
	});
	assert.deepEqual(
		normalizeReviewSearch({ queue: "low-confidence", limit: 220 }),
		{ queue: "low-confidence", limit: 220 },
	);
});

test("parses and sorts the BirdNET species catalog", () => {
	assert.deepEqual(
		parseSpeciesCatalog(
			'{"Turdus migratorius":"American Robin","Cyanocitta cristata":"Blue Jay"}',
		),
		[
			{ sciName: "Turdus migratorius", comName: "American Robin" },
			{ sciName: "Cyanocitta cristata", comName: "Blue Jay" },
		],
	);
});

test("renames only the BirdNET species prefix", () => {
	assert.equal(
		recategorizedFileName(
			"American_Robin-90-2026-07-27-birdnet-06:00:00.mp3",
			"American Robin",
			"Blue Jay",
		),
		"Blue_Jay-90-2026-07-27-birdnet-06:00:00.mp3",
	);
	assert.equal(
		recategorizedFileName("other.mp3", "American Robin", "Blue Jay"),
		null,
	);
});
