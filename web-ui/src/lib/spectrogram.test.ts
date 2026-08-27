import assert from "node:assert/strict";
import test from "node:test";

import { rampColor, type Rgb } from "./spectrogram.ts";

const STOPS: Rgb[] = [
	[0, 0, 0],
	[100, 100, 100],
	[200, 200, 200],
];

test("returns the first stop at t=0 and the last at t=1", () => {
	assert.deepEqual(rampColor(STOPS, 0), [0, 0, 0]);
	assert.deepEqual(rampColor(STOPS, 1), [200, 200, 200]);
});

test("interpolates linearly within a segment", () => {
	// t=0.25 lands halfway into the first of two segments -> [50,50,50]
	assert.deepEqual(rampColor(STOPS, 0.25), [50, 50, 50]);
	// t=0.75 lands halfway into the second segment -> [150,150,150]
	assert.deepEqual(rampColor(STOPS, 0.75), [150, 150, 150]);
});

test("clamps t outside [0,1]", () => {
	assert.deepEqual(rampColor(STOPS, -1), [0, 0, 0]);
	assert.deepEqual(rampColor(STOPS, 2), [200, 200, 200]);
});
