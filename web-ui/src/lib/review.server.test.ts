import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as fileSystem from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
	correctDetection,
	loadReviewPage,
	recategorizeDetection,
} from "./review.server.ts";

function fixture() {
	const database = new DatabaseSync(":memory:");
	database.exec(
		"CREATE TABLE detections (Date TEXT, Time TEXT, Sci_Name TEXT, Com_Name TEXT, Confidence REAL, File_Name TEXT)",
	);
	const insert = database.prepare(
		"INSERT INTO detections VALUES (?, ?, ?, ?, ?, ?)",
	);
	insert.run(
		"2026-07-27",
		"06:00",
		"Piranga olivacea",
		"Scarlet Tanager",
		0.4,
		"Scarlet_Tanager-a.mp3",
	);
	insert.run(
		"2026-07-26",
		"06:00",
		"Cyanocitta cristata",
		"Blue Jay",
		0.2,
		"Blue_Jay-a.mp3",
	);
	insert.run(
		"2026-07-25",
		"06:00",
		"Cyanocitta cristata",
		"Blue Jay",
		1,
		"Blue_Jay-confirmed.mp3",
	);
	return database;
}

test("loads one weakest eligible recording per rare species", async () => {
	const database = fixture();
	const root = await mkdtemp(path.join(tmpdir(), "birdnet-review-"));
	const audio = path.join(root, "By_Date", "2026-07-27", "Scarlet_Tanager");
	mkdirSync(audio, { recursive: true });
	writeFileSync(path.join(audio, "Scarlet_Tanager-a.mp3"), "audio");
	const page = loadReviewPage(database, root, { queue: "rare", limit: 20 });
	assert.deepEqual(
		page.candidates.map((row) => row.comName),
		["Scarlet Tanager", "Blue Jay"],
	);
	assert.equal(page.candidates[0]?.audioAvailable, true);
	database.close();
});

test("correct marks the selected row as 100 percent", () => {
	const database = fixture();
	correctDetection(database, 1);
	assert.equal(
		database.prepare("SELECT Confidence FROM detections WHERE rowid=1").get()
			?.Confidence,
		1,
	);
	database.close();
});

test("recategorizing a shared recording copies assets for the selected row", async () => {
	const database = fixture();
	database
		.prepare("INSERT INTO detections VALUES (?, ?, ?, ?, ?, ?)")
		.run(
			"2026-07-27",
			"06:01",
			"Piranga olivacea",
			"Scarlet Tanager",
			0.5,
			"Scarlet_Tanager-a.mp3",
		);
	const root = await mkdtemp(path.join(tmpdir(), "birdnet-review-shared-"));
	const oldDir = path.join(root, "By_Date", "2026-07-27", "Scarlet_Tanager");
	mkdirSync(oldDir, { recursive: true });
	const oldAudio = path.join(oldDir, "Scarlet_Tanager-a.mp3");
	writeFileSync(oldAudio, "shared audio");
	writeFileSync(`${oldAudio}.png`, "shared image");
	await recategorizeDetection(
		database,
		root,
		1,
		{ sciName: "Cyanocitta cristata", comName: "Blue Jay" },
		[{ sciName: "Cyanocitta cristata", comName: "Blue Jay" }],
	);
	const newAudio = path.join(
		root,
		"By_Date",
		"2026-07-27",
		"Blue_Jay",
		"Blue_Jay-a.mp3",
	);
	assert.equal(readFileSync(oldAudio, "utf8"), "shared audio");
	assert.equal(readFileSync(newAudio, "utf8"), "shared audio");
	assert.equal(existsSync(`${oldAudio}.png`), true);
	assert.equal(existsSync(`${newAudio}.png`), true);
	database.close();
});

test("recategorization restores audio when moving the spectrogram fails", async () => {
	const database = fixture();
	const root = await mkdtemp(path.join(tmpdir(), "birdnet-review-rollback-"));
	const oldDir = path.join(root, "By_Date", "2026-07-27", "Scarlet_Tanager");
	mkdirSync(oldDir, { recursive: true });
	const oldAudio = path.join(oldDir, "Scarlet_Tanager-a.mp3");
	writeFileSync(oldAudio, "audio");
	writeFileSync(`${oldAudio}.png`, "image");
	await assert.rejects(
		recategorizeDetection(
			database,
			root,
			1,
			{ sciName: "Cyanocitta cristata", comName: "Blue Jay" },
			[{ sciName: "Cyanocitta cristata", comName: "Blue Jay" }],
			{
				...fileSystem,
				rename: async (oldPath, newPath) => {
					if (oldPath.toString().endsWith(".png"))
						throw new Error("spectrogram locked");
					await fileSystem.rename(oldPath, newPath);
				},
			},
		),
		/spectrogram locked/,
	);
	assert.equal(readFileSync(oldAudio, "utf8"), "audio");
	assert.equal(existsSync(`${oldAudio}.png`), true);
	assert.equal(
		database.prepare("SELECT Com_Name FROM detections WHERE rowid=1").get()
			?.Com_Name,
		"Scarlet Tanager",
	);
	database.close();
});
