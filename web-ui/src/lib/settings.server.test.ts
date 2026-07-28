import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
	loadSettingsPageData,
	savePrivacySettings,
	saveStorageSettings,
} from "./settings.server.ts";

async function fixtureConfig(contents: string) {
	const directory = await mkdtemp(path.join(tmpdir(), "birdnet-settings-save-"));
	const file = path.join(directory, "birdnet.conf");
	await writeFile(file, contents, "utf8");
	return { directory, file };
}

test("invalid settings neither write configuration nor run commands", async () => {
	const { file } = await fixtureConfig("PRIVACY_THRESHOLD=0\n");
	let commands = 0;
	await assert.rejects(
		savePrivacySettings(
			{ privacyThreshold: 4 },
			{
				settingsPath: file,
				runner: async () => {
					commands++;
				},
			},
		),
	);
	assert.equal(await readFile(file, "utf8"), "PRIVACY_THRESHOLD=0\n");
	assert.equal(commands, 0);
});

test("a failed restart leaves saved values and reports partial success", async () => {
	const { file } = await fixtureConfig("PRIVACY_THRESHOLD=0\n");
	const result = await savePrivacySettings(
		{ privacyThreshold: 2 },
		{
			settingsPath: file,
			runner: async () => {
				throw new Error("systemctl exposed output");
			},
		},
	);
	assert.equal(await readFile(file, "utf8"), "PRIVACY_THRESHOLD=2\n");
	assert.equal(result.status, "saved-action-failed");
	assert.equal(result.values.privacyThreshold, 2);
	assert.doesNotMatch(result.message, /systemctl exposed output/);
});

test("development skip is explicit while no-action cards save normally", async () => {
	const privacy = await fixtureConfig("PRIVACY_THRESHOLD=0\n");
	const skipped = await savePrivacySettings(
		{ privacyThreshold: 1 },
		{ settingsPath: privacy.file, skipSystemActions: true },
	);
	assert.equal(skipped.status, "saved-restart-skipped");

	const storage = await fixtureConfig(
		"FULL_DISK=purge\nPURGE_THRESHOLD=95\nMAX_FILES_SPECIES=0\n",
	);
	const saved = await saveStorageSettings(
		{
			fullDiskAction: "keep",
			purgeThreshold: 90,
			maxFilesPerSpecies: 100,
		},
		{ settingsPath: storage.file },
	);
	assert.equal(saved.status, "saved");
});

test("loads installed model choices and normalized configuration", async () => {
	const { directory, file } = await fixtureConfig(
		[
			'SITE_NAME="Backyard"',
			"LATITUDE=41.1",
			"LONGITUDE=-93.2",
			"MODEL=BirdNET_GLOBAL_6K_V2.4_Model_FP16",
			"DATA_MODEL_VERSION=1",
			"SF_THRESH=0.03",
			"CONFIDENCE=0.7",
			"SENSITIVITY=1.25",
			"OVERLAP=0",
			"PRIVACY_THRESHOLD=0",
			"REC_CARD=default",
			"CHANNELS=2",
			"RTSP_STREAM=",
			"RTSP_STREAM_TO_LIVESTREAM=0",
			"RECORDING_LENGTH=15",
			"EXTRACTION_LENGTH=",
			"AUDIOFMT=mp3",
			"FULL_DISK=purge",
			"PURGE_THRESHOLD=95",
			"MAX_FILES_SPECIES=0",
		].join("\n"),
	);
	await writeFile(
		path.join(directory, "BirdNET_GLOBAL_6K_V2.4_Model_FP16.tflite"),
		"model",
	);
	const page = await loadSettingsPageData({
		settingsPath: file,
		modelDirectory: directory,
		currentTimezone: "America/Chicago",
	});
	assert.equal(page.station.siteName, "Backyard");
	assert.equal(page.station.timezone, "America/Chicago");
	assert.deepEqual(
		page.supportedModels.map((model) => model.id),
		["BirdNET_GLOBAL_6K_V2.4_Model_FP16"],
	);
	assert.ok(page.supportedTimezones.includes("America/Chicago"));
	assert.equal(page.review.rareSpeciesMax, 10);
});

test("configuration access errors do not reveal paths", async () => {
	const missing = path.join(tmpdir(), "birdnet-secret-location", "missing.conf");
	await assert.rejects(
		loadSettingsPageData({ settingsPath: missing }),
		(error: Error) => {
			assert.equal(error.message, "BirdNET settings are unavailable.");
			assert.doesNotMatch(error.message, /birdnet-secret-location/);
			return true;
		},
	);
});
