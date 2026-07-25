import assert from "node:assert/strict";
import test from "node:test";
import type { SpeciesCount } from "./stats-data.ts";
import {
	buildDetectionTrend,
	buildHourActivity,
	hourLabel,
	rankingBarPercent,
	selectTrendGranularity,
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

test("selects adaptive trend granularity at inclusive day boundaries", () => {
	assert.equal(selectTrendGranularity("2025-01-01", "2025-04-30"), "day");
	assert.equal(selectTrendGranularity("2025-01-01", "2025-05-01"), "week");
	assert.equal(selectTrendGranularity("2024-01-01", "2025-12-30"), "week");
	assert.equal(selectTrendGranularity("2024-01-01", "2025-12-31"), "month");
});

test("builds ordered zero-filled daily detection buckets", () => {
	assert.deepEqual(
		buildDetectionTrend(
			[
				{ bucket: "2026-07-01", count: 2 },
				{ bucket: "2026-07-03", count: 4 },
			],
			"2026-07-01",
			"2026-07-03",
			"day",
		).map(({ bucket, count }) => ({ bucket, count })),
		[
			{ bucket: "2026-07-01", count: 2 },
			{ bucket: "2026-07-02", count: 0 },
			{ bucket: "2026-07-03", count: 4 },
		],
	);
});

test("builds Monday-based weekly and calendar-month buckets", () => {
	assert.deepEqual(
		buildDetectionTrend(
			[
				{ bucket: "2026-07-20", count: 3 },
				{ bucket: "2026-08-03", count: 5 },
			],
			"2026-07-22",
			"2026-08-04",
			"week",
		).map(({ bucket, count }) => ({ bucket, count })),
		[
			{ bucket: "2026-07-20", count: 3 },
			{ bucket: "2026-07-27", count: 0 },
			{ bucket: "2026-08-03", count: 5 },
		],
	);

	assert.deepEqual(
		buildDetectionTrend(
			[
				{ bucket: "2024-01", count: 2 },
				{ bucket: "2024-03", count: 7 },
			],
			"2024-01-15",
			"2024-03-02",
			"month",
		).map(({ bucket, count }) => ({ bucket, count })),
		[
			{ bucket: "2024-01", count: 2 },
			{ bucket: "2024-02", count: 0 },
			{ bucket: "2024-03", count: 7 },
		],
	);
});

test("returns an empty detection trend without valid bounds", () => {
	assert.deepEqual(buildDetectionTrend([], null, null, "day"), []);
});
