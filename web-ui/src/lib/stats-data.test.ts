import assert from "node:assert/strict";
import test from "node:test";
import type { SpeciesCount } from "./stats-data.ts";
import {
	buildHourActivity,
	hourLabel,
	rankingBarPercent,
	selectBusiestHour,
} from "./stats-data.ts";

const speciesFixture: SpeciesCount = {
	comName: "Northern Cardinal",
	sciName: "Cardinalis cardinalis",
	count: 12,
	imageUrl: "/illustrations/cardinalis-cardinalis.png",
};

test("builds all 24 ordered hours and fills missing hours with zero", () => {
	const result = buildHourActivity([
		{ hour: 23, count: 2 },
		{ hour: 7, count: 5 },
	]);

	assert.equal(result.length, 24);
	assert.deepEqual(result[7], { hour: 7, count: 5 });
	assert.deepEqual(result[8], { hour: 8, count: 0 });
	assert.deepEqual(result[23], { hour: 23, count: 2 });
});

test("selects the earliest busiest hour and handles empty activity", () => {
	assert.deepEqual(
		selectBusiestHour(
			buildHourActivity([
				{ hour: 9, count: 4 },
				{ hour: 17, count: 4 },
			]),
		),
		{ hour: 9, count: 4 },
	);
	assert.equal(selectBusiestHour(buildHourActivity([])), null);
});

test("formats friendly hours and visible proportional ranking widths", () => {
	assert.equal(hourLabel(0), "12 AM");
	assert.equal(hourLabel(12), "12 PM");
	assert.equal(hourLabel(17), "5 PM");
	assert.equal(rankingBarPercent(1, 100), 2);
	assert.equal(rankingBarPercent(50, 100), 50);
});

test("species rankings carry navigation and artwork data", () => {
	assert.equal(speciesFixture.sciName, "Cardinalis cardinalis");
	assert.match(speciesFixture.imageUrl ?? "", /cardinalis-cardinalis/);
});
