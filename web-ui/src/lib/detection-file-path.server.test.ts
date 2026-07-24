import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { resolveDetectionClipPath } from "./detection-file-path.server.ts";

test("resolves a detection clip beneath the extracted root", () => {
	assert.equal(
		resolveDetectionClipPath("C:\\clips", {
			date: "2026-07-23",
			commonName: "House Sparrow",
			fileName: "call.wav",
		}),
		path.join(
			"C:\\clips",
			"By_Date",
			"2026-07-23",
			"House_Sparrow",
			"call.wav",
		),
	);
});

test("rejects a clip path that escapes the extracted root", () => {
	assert.equal(
		resolveDetectionClipPath("C:\\clips", {
			date: "2026-07-23",
			commonName: "House Sparrow",
			fileName: "../../outside.wav",
		}),
		null,
	);
});
