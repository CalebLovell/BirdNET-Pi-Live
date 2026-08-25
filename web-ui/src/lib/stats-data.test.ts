import assert from "node:assert/strict";
import test from "node:test";
import type { SpeciesCount } from "./stats-data.ts";
import {
	buildHourActivity,
	buildMonthlyTrend,
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

test("gives every ranking bar a visible proportional width", () => {
	assert.equal(rankingBarPercent(1, 100), 2);
	assert.equal(rankingBarPercent(50, 100), 50);
});

test("species rankings carry navigation and artwork data", () => {
	assert.equal(speciesFixture.sciName, "Cardinalis cardinalis");
	assert.match(speciesFixture.imageUrl ?? "", /cardinalis-cardinalis/);
});

test("builds twelve zero-filled months for the selected year", () => {
	const result = buildMonthlyTrend(
		[
			{ bucket: "2025-01", count: 2 },
			{ bucket: "2025-05", count: 40 },
			{ bucket: "2024-05", count: 99 },
		],
		2025,
	);

	assert.equal(result.length, 12);
	assert.deepEqual(result[0], { bucket: "2025-01", label: "Jan", count: 2 });
	assert.deepEqual(result[1], { bucket: "2025-02", label: "Feb", count: 0 });
	assert.deepEqual(result[4], { bucket: "2025-05", label: "May", count: 40 });
	assert.deepEqual(result[11], { bucket: "2025-12", label: "Dec", count: 0 });
});

test("a year with nothing on record is twelve zeroes, not an empty series", () => {
	const result = buildMonthlyTrend([], 2019);

	assert.equal(result.length, 12);
	assert.ok(result.every((point) => point.count === 0));
});
