import assert from "node:assert/strict";
import test from "node:test";
import {
	applySpeciesStatus,
	normalizeSpeciesControlSave,
	speciesControlDeleteSchema,
	speciesControlInputWithStatus,
	speciesControlResetInput,
	speciesControlSaveSchema,
	speciesStatusFor,
} from "./species-control-data.ts";

test("reset input clears managed lists without removing unresolved entries", () => {
	assert.deepEqual(speciesControlResetInput("revision-42"), {
		revision: "revision-42",
		custom: [],
		excluded: [],
		whitelisted: [],
		removeUnresolved: [],
	});
});

test("bulk status input proposes a save without mutating current lists", () => {
	const current = {
		revision: "revision-42",
		custom: ["Canis latrans"],
		excluded: ["Sciurus carolinensis"],
		whitelisted: ["Procyon lotor"],
		removeUnresolved: [],
	};
	assert.deepEqual(
		speciesControlInputWithStatus(
			current,
			["Canis latrans", "Sciurus carolinensis"],
			"always",
		),
		{
			revision: "revision-42",
			custom: [],
			excluded: [],
			whitelisted: ["Procyon lotor", "Canis latrans", "Sciurus carolinensis"],
			removeUnresolved: [],
		},
	);
	assert.deepEqual(current, {
		revision: "revision-42",
		custom: ["Canis latrans"],
		excluded: ["Sciurus carolinensis"],
		whitelisted: ["Procyon lotor"],
		removeUnresolved: [],
	});
});

test("status resolution gives explicit policies precedence over list membership", () => {
	assert.equal(
		speciesStatusFor({ custom: true, excluded: true, whitelisted: true }),
		"never",
	);
	assert.equal(
		speciesStatusFor({ custom: true, excluded: false, whitelisted: true }),
		"always",
	);
	assert.equal(
		speciesStatusFor({ custom: true, excluded: false, whitelisted: false }),
		"custom",
	);
	assert.equal(
		speciesStatusFor({ custom: false, excluded: false, whitelisted: false }),
		"automatic",
	);
});

test("applying a status produces mutually exclusive list memberships", () => {
	assert.equal(applySpeciesStatus.length, 1);
	assert.deepEqual(applySpeciesStatus("automatic"), {
		custom: false,
		excluded: false,
		whitelisted: false,
	});
	assert.deepEqual(applySpeciesStatus("custom"), {
		custom: true,
		excluded: false,
		whitelisted: false,
	});
	assert.deepEqual(applySpeciesStatus("always"), {
		custom: false,
		excluded: false,
		whitelisted: true,
	});
	assert.deepEqual(applySpeciesStatus("never"), {
		custom: false,
		excluded: true,
		whitelisted: false,
	});
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
