import assert from "node:assert/strict";
import {
	chmod,
	mkdtemp,
	readdir,
	readFile,
	stat,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
	parseBirdnetConfig,
	readReviewRareSpeciesMax,
	readSettingsPageValues,
	resolveSettingsPath,
	writeSettingsCard,
} from "./settings-config.server.ts";

async function fixtureConfig(contents: string) {
	const directory = await mkdtemp(path.join(tmpdir(), "birdnet-settings-"));
	const file = path.join(directory, "birdnet.conf");
	await writeFile(file, contents, "utf8");
	return file;
}

test("parses quoted, unquoted, and blank shell assignments", () => {
	const parsed = parseBirdnetConfig(
		[
			'# comment',
			'SITE_NAME="Creek \\"North\\""',
			"LATITUDE=41.25",
			"EXTRACTION_LENGTH=",
		].join("\n"),
	);
	assert.equal(parsed.SITE_NAME, 'Creek "North"');
	assert.equal(parsed.LATITUDE, "41.25");
	assert.equal(parsed.EXTRACTION_LENGTH, "");
});

test("uses BIRDNET_CONF before the production path", () => {
	const previous = process.env.BIRDNET_CONF;
	process.env.BIRDNET_CONF = "C:\\fixture\\birdnet.conf";
	try {
		assert.equal(resolveSettingsPath(), "C:\\fixture\\birdnet.conf");
	} finally {
		if (previous === undefined) delete process.env.BIRDNET_CONF;
		else process.env.BIRDNET_CONF = previous;
	}
	assert.equal(resolveSettingsPath(), previous ?? "/etc/birdnet/birdnet.conf");
});

test("updates only Station assignments and preserves the document", async () => {
	const before = [
		"# station",
		'SITE_NAME="Backyard"',
		"LATITUDE=41.0000",
		"LONGITUDE=-93.0000",
		"BIRDWEATHER_ID=secret-that-must-survive",
		'RTSP_STREAM="rtsp://bird:secret@camera/live"',
		"",
	].join("\n");
	const file = await fixtureConfig(before);
	await chmod(file, 0o640);
	const originalMode = (await stat(file)).mode & 0o777;
	await writeSettingsCard(
		"station",
		{
			siteName: 'Creek "North"',
			latitude: 42.25,
			longitude: -92.75,
			timezone: "America/Chicago",
		},
		file,
	);
	const after = await readFile(file, "utf8");
	assert.match(after, /^# station/m);
	assert.match(after, /^SITE_NAME="Creek \\"North\\""$/m);
	assert.match(after, /^LATITUDE=42.25$/m);
	assert.match(after, /^LONGITUDE=-92.75$/m);
	assert.match(after, /^BIRDWEATHER_ID=secret-that-must-survive$/m);
	assert.match(after, /^RTSP_STREAM="rtsp:\/\/bird:secret@camera\/live"$/m);
	assert.equal((await stat(file)).mode & 0o777, originalMode);
	assert.deepEqual(await readdir(path.dirname(file)), ["birdnet.conf"]);
});

test("appends the Review setting once and defaults older files", async () => {
	const file = await fixtureConfig("CONFIDENCE=0.7\n");
	assert.equal(await readReviewRareSpeciesMax(file), 10);
	await writeSettingsCard("review", { rareSpeciesMax: 12 }, file);
	await writeSettingsCard("review", { rareSpeciesMax: 14 }, file);
	const text = await readFile(file, "utf8");
	assert.equal(text.match(/^REVIEW_RARE_SPECIES_MAX=/gm)?.length, 1);
	assert.match(text, /^REVIEW_RARE_SPECIES_MAX=14$/m);
	assert.equal(await readReviewRareSpeciesMax(file), 14);
});

test("round-trips RTSP streams and blank extraction length", async () => {
	const file = await fixtureConfig(
		[
			"REC_CARD=default",
			"CHANNELS=2",
			"RTSP_STREAM=",
			"RTSP_STREAM_TO_LIVESTREAM=0",
			"RECORDING_LENGTH=15",
			"EXTRACTION_LENGTH=",
			"AUDIOFMT=mp3",
		].join("\n"),
	);
	await writeSettingsCard(
		"audio",
		{
			mode: "rtsp",
			recordingDevice: "default",
			channels: 2,
			rtspStreams: ["rtsp://one/live", "rtsps://two/live"],
			livestreamIndex: 1,
		},
		file,
	);
	const settings = await readSettingsPageValues(file, "America/Chicago");
	assert.equal(settings.audio.mode, "rtsp");
	assert.deepEqual(settings.audio.rtspStreams, [
		"rtsp://one/live",
		"rtsps://two/live",
	]);
	assert.equal(settings.audio.livestreamIndex, 1);
	assert.equal(settings.recording.extractionLength, null);
});

test("rejects newlines before writing configuration strings", async () => {
	const file = await fixtureConfig('SITE_NAME="Backyard"\nLATITUDE=0\nLONGITUDE=0\n');
	await assert.rejects(
		writeSettingsCard(
			"station",
			{
				siteName: "Injected\nFULL_DISK=keep",
				latitude: 0,
				longitude: 0,
				timezone: "America/Chicago",
			},
			file,
		),
	);
	assert.equal(
		await readFile(file, "utf8"),
		'SITE_NAME="Backyard"\nLATITUDE=0\nLONGITUDE=0\n',
	);
});
