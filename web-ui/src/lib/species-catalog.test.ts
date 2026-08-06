import assert from "node:assert/strict";
import test from "node:test";

import {
	type CatalogSpecies,
	findCatalogSpeciesBySlug,
} from "~/lib/species-catalog.ts";

const CATALOG: CatalogSpecies[] = [
	{ sciName: "Cardinalis cardinalis", comName: "Northern Cardinal" },
	{ sciName: "Calypte anna", comName: "Anna's Hummingbird" },
	{ sciName: "Poecile atricapillus", comName: "Black-capped Chickadee" },
];

test("a slug resolves to its catalog entry", () => {
	assert.deepEqual(findCatalogSpeciesBySlug("northern-cardinal", CATALOG), {
		sciName: "Cardinalis cardinalis",
		comName: "Northern Cardinal",
	});
});

test("punctuation dropped by the slug still resolves", () => {
	assert.equal(
		findCatalogSpeciesBySlug("annas-hummingbird", CATALOG)?.sciName,
		"Calypte anna",
	);
	assert.equal(
		findCatalogSpeciesBySlug("black-capped-chickadee", CATALOG)?.sciName,
		"Poecile atricapillus",
	);
});

test("an unknown slug resolves to nothing", () => {
	assert.equal(findCatalogSpeciesBySlug("keel-billed-toucen", CATALOG), null);
	assert.equal(findCatalogSpeciesBySlug("", CATALOG), null);
});

test("an empty catalog resolves to nothing", () => {
	assert.equal(findCatalogSpeciesBySlug("northern-cardinal", []), null);
});
