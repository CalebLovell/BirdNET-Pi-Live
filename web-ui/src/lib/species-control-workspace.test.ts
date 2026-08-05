import assert from "node:assert/strict";
import test from "node:test";
import {
	nextSpeciesControlSort,
	normalizeSpeciesControlWorkspaceSearch,
} from "./species-control-workspace.ts";

test("normalizes valid Species Control URL state", () => {
	assert.deepEqual(
		normalizeSpeciesControlWorkspaceSearch({
			page: 3.9,
			sort: "count",
			direction: "desc",
			query: "  owl  ",
		}),
		{ page: 3, sort: "count", direction: "desc", query: "owl" },
	);
});

test("falls back from invalid URL values and omits an empty query", () => {
	assert.deepEqual(
		normalizeSpeciesControlWorkspaceSearch({
			page: -4,
			sort: "unknown",
			direction: "sideways",
			query: "   ",
		}),
		{ page: 1, sort: "species", direction: "asc" },
	);
	assert.equal(
		normalizeSpeciesControlWorkspaceSearch({ query: 93 }).query,
		"93",
	);
});

test("resets the page and applies natural direction when sorting", () => {
	const current = {
		page: 4,
		sort: "species" as const,
		direction: "asc" as const,
		query: "owl",
	};

	assert.deepEqual(nextSpeciesControlSort(current, "species"), {
		...current,
		page: 1,
		direction: "desc",
	});
	assert.deepEqual(nextSpeciesControlSort(current, "count"), {
		...current,
		page: 1,
		sort: "count",
		direction: "desc",
	});
	assert.deepEqual(nextSpeciesControlSort(current, "scientific"), {
		...current,
		page: 1,
		sort: "scientific",
		direction: "asc",
	});
});
