import assert from "node:assert/strict";
import test from "node:test";
import {
	applySpeciesPolicy,
	normalizeSpeciesControlSave,
	speciesControlDeleteSchema,
	speciesControlSaveSchema,
} from "./species-control-data.ts";

test("never detect clears conflicting memberships", () => {
	assert.deepEqual(
		applySpeciesPolicy({ custom: true, policy: "always" }, "never", true),
		{ custom: false, policy: "never" },
	);
});

test("always detect joins Custom while custom-only mode is active", () => {
	assert.deepEqual(
		applySpeciesPolicy({ custom: false, policy: "never" }, "always", true),
		{ custom: true, policy: "always" },
	);
	assert.deepEqual(
		applySpeciesPolicy({ custom: true, policy: "always" }, "automatic", true),
		{ custom: true, policy: "automatic" },
	);
});

test("save normalization trims, stably deduplicates, and preserves list order", () => {
	assert.deepEqual(
		normalizeSpeciesControlSave({
			revision: "abc",
			custom: [" Canis latrans ", "Sciurus carolinensis", "Canis latrans"],
			excluded: [" Procyon lotor ", "Procyon lotor"],
			whitelisted: [],
			removeUnresolved: [
				{ list: "excluded", raw: " Old species_Name " },
				{ list: "excluded", raw: "Old species_Name" },
			],
		}),
		{
			revision: "abc",
			custom: ["Canis latrans", "Sciurus carolinensis"],
			excluded: ["Procyon lotor"],
			whitelisted: [],
			removeUnresolved: [{ list: "excluded", raw: "Old species_Name" }],
		},
	);
});

test("save schema rejects invalid scientific names, oversized lists, and extra keys", () => {
	const base = {
		revision: "abc",
		custom: ["Canis latrans"],
		excluded: [],
		whitelisted: [],
		removeUnresolved: [],
	};
	assert.equal(speciesControlSaveSchema.safeParse(base).success, true);
	assert.equal(
		speciesControlSaveSchema.safeParse({ ...base, custom: ["coyote"] }).success,
		false,
	);
	assert.equal(
		speciesControlSaveSchema.safeParse({
			...base,
			custom: Array.from({ length: 7_001 }, () => "Canis latrans"),
		}).success,
		false,
	);
	assert.equal(
		speciesControlSaveSchema.safeParse({ ...base, filesystemPath: "C:/" })
			.success,
		false,
	);
});

test("delete schema accepts only an exact scientific name and row count", () => {
	assert.deepEqual(
		speciesControlDeleteSchema.parse({
			sciName: "Didelphis virginiana",
			expectedRows: 4,
		}),
		{ sciName: "Didelphis virginiana", expectedRows: 4 },
	);
	assert.equal(
		speciesControlDeleteSchema.safeParse({
			sciName: " opossum ",
			expectedRows: -1,
		}).success,
		false,
	);
});
