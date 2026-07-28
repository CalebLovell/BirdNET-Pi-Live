import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { correctDetection, loadReviewPage } from "./review.server.ts";

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
