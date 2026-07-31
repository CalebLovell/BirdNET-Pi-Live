import assert from "node:assert/strict";
import test from "node:test";

import {
	deleteSpeciesHistoryFn,
	getSpeciesControlPage,
	getSpeciesHistoryDeletePreview,
	getSpeciesRangePreview,
	saveSpeciesControl,
} from "./species-control.ts";

test("species control exposes only the named browser operations", () => {
	for (const operation of [
		getSpeciesControlPage,
		saveSpeciesControl,
		getSpeciesRangePreview,
		getSpeciesHistoryDeletePreview,
		deleteSpeciesHistoryFn,
	]) {
		assert.equal(typeof operation, "function");
	}
});
