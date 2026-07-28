import assert from "node:assert/strict";
import test from "node:test";

import {
	getSettingsPage,
	saveAudioSettingsFn,
	saveDetectionSettingsFn,
	savePrivacySettingsFn,
	saveRecordingSettingsFn,
	saveReviewSettingsFn,
	saveStationSettingsFn,
	saveStorageSettingsFn,
} from "./settings.ts";

test("exports one loader and one save function for every settings card", () => {
	for (const serverFunction of [
		getSettingsPage,
		saveStationSettingsFn,
		saveDetectionSettingsFn,
		savePrivacySettingsFn,
		saveAudioSettingsFn,
		saveRecordingSettingsFn,
		saveStorageSettingsFn,
		saveReviewSettingsFn,
	]) {
		assert.equal(typeof serverFunction, "function");
	}
});
