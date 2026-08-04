import assert from "node:assert/strict";
import test from "node:test";

import * as speciesControl from "./species-control.ts";

test("species control exposes only the named browser operations", () => {
	// Deleting a species' detection history is deliberately not reachable from
	// the browser: the server helpers still exist and stay tested, but nothing
	// mounts them until that tool finds a home of its own.
	assert.deepEqual(Object.keys(speciesControl).sort(), [
		"getSpeciesControlPage",
		"saveSpeciesControl",
	]);
	assert.equal(typeof speciesControl.getSpeciesControlPage, "function");
	assert.equal(typeof speciesControl.saveSpeciesControl, "function");
});
