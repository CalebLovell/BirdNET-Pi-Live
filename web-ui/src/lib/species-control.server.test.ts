import assert from "node:assert/strict";
import {
	chmod,
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	stat,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
	deleteSpeciesHistory,
	loadInstalledSpeciesCatalog,
	loadSpeciesControlPage,
	parseSpeciesList,
	previewSpeciesHistoryDeletion,
	resolveSpeciesListDirectory,
	resolveSpeciesModelDirectory,
	saveSpeciesControlLists,
} from "./species-control.server.ts";

async function fixture() {
	const root = await mkdtemp(path.join(tmpdir(), "birdnet-species-control-"));
	const lists = path.join(root, "lists");
	const model = path.join(root, "model");
	await Promise.all([
		import("node:fs/promises").then(({ mkdir }) => mkdir(lists)),
		import("node:fs/promises").then(({ mkdir }) =>
			mkdir(path.join(model, "l18n"), { recursive: true }),
		),
	]);
	const config = path.join(root, "birdnet.conf");
	await writeFile(config, "MODEL=Fixture_Model\n", "utf8");
	await writeFile(
		path.join(model, "Fixture_Model_Labels.txt"),
		["Canis latrans", "Sciurus carolinensis", "Unknownus modelii"].join("\n"),
		"utf8",
	);
	await writeFile(
		path.join(model, "l18n", "labels_en.json"),
		JSON.stringify({
			"Canis latrans": "Coyote",
			"Sciurus carolinensis": "Eastern Gray Squirrel",
			"Didelphis virginiana": "Virginia Opossum",
		}),
		"utf8",
	);
	await writeFile(
		path.join(lists, "include_species_list.txt"),
		"Canis latrans_Coyote\n",
		"utf8",
	);
	await writeFile(
		path.join(lists, "exclude_species_list.txt"),
		"Sciurus carolinensis\nStale species_Old name\n",
		"utf8",
	);
	await writeFile(
		path.join(lists, "whitelist_species_list.txt"),
		"Canis latrans_Coyote\n",
		"utf8",
	);
	const database = new DatabaseSync(":memory:");
	database.exec(
		"CREATE TABLE detections (Date TEXT, Time TEXT, Sci_Name TEXT, Com_Name TEXT, Confidence REAL, File_Name TEXT)",
	);
	const insert = database.prepare(
		"INSERT INTO detections VALUES (?, ?, ?, ?, ?, ?)",
	);
	insert.run(
		"2026-07-30",
		"22:00",
		"Canis latrans",
		"Coyote",
		0.71,
		"coyote-a.mp3",
	);
	insert.run(
		"2026-07-31",
		"01:00",
		"Canis latrans",
		"Coyote",
		0.93,
		"coyote-a.mp3",
	);
	insert.run(
		"2026-07-29",
		"08:00",
		"Sciurus carolinensis",
		"Eastern Gray Squirrel",
		0.82,
		"squirrel-a.mp3",
	);
	return { root, lists, model, config, database };
}

test("environment overrides resolve list and model directories lazily", () => {
	const oldLists = process.env.BIRDNET_SPECIES_LIST_DIR;
	const oldModel = process.env.BIRDNET_MODEL_DIR;
	process.env.BIRDNET_SPECIES_LIST_DIR = "C:\\fixture\\lists";
	process.env.BIRDNET_MODEL_DIR = "C:\\fixture\\model";
	try {
		assert.equal(resolveSpeciesListDirectory(), "C:\\fixture\\lists");
		assert.equal(resolveSpeciesModelDirectory(), "C:\\fixture\\model");
	} finally {
		if (oldLists === undefined) delete process.env.BIRDNET_SPECIES_LIST_DIR;
		else process.env.BIRDNET_SPECIES_LIST_DIR = oldLists;
		if (oldModel === undefined) delete process.env.BIRDNET_MODEL_DIR;
		else process.env.BIRDNET_MODEL_DIR = oldModel;
	}
});

test("list parser accepts scientific-only and legacy scientific_common lines", () => {
	const catalog = [
		{ sciName: "Canis latrans", comName: "Coyote" },
		{ sciName: "Sciurus carolinensis", comName: "Eastern Gray Squirrel" },
	];
	assert.deepEqual(
		parseSpeciesList(
			"Canis latrans\nSciurus carolinensis_Eastern Gray Squirrel\nold_unknown\n",
			catalog,
		),
		{
			known: ["Canis latrans", "Sciurus carolinensis"],
			unresolved: ["old_unknown"],
		},
	);
});

test("catalog contains only labels the active classifier can emit", async () => {
	const item = await fixture();
	try {
		assert.deepEqual(
			await loadInstalledSpeciesCatalog({
				modelDirectory: item.model,
				settingsPath: item.config,
			}),
			[
				{ sciName: "Canis latrans", comName: "Coyote" },
				{ sciName: "Sciurus carolinensis", comName: "Eastern Gray Squirrel" },
			],
		);
	} finally {
		item.database.close();
	}
});

test("page joins policy files with detection history and preserves unresolved lines", async () => {
	const item = await fixture();
	try {
		const page = await loadSpeciesControlPage({
			listDirectory: item.lists,
			modelDirectory: item.model,
			settingsPath: item.config,
			database: item.database,
		});
		assert.equal(page.customMode, true);
		assert.deepEqual(page.unresolved.excluded, ["Stale species_Old name"]);
		assert.deepEqual(
			page.rows.map(({ sciName }) => sciName),
			["Canis latrans", "Sciurus carolinensis"],
		);
		assert.deepEqual(page.rows[0]?.history, {
			detections: 2,
			maxConfidence: 0.93,
			lastSeen: "2026-07-31T01:00",
			recordings: 2,
		});
		assert.equal(page.rows[0]?.custom, true);
		assert.equal(page.rows[0]?.whitelisted, true);
		assert.equal(page.rows[1]?.excluded, true);
		assert.match(page.revision, /^[a-f0-9]{64}$/);
	} finally {
		item.database.close();
	}
});

test("missing list files are treated as empty and recorded as absent", async () => {
	const item = await fixture();
	try {
		await import("node:fs/promises").then(({ rm }) =>
			rm(path.join(item.lists, "whitelist_species_list.txt")),
		);
		const page = await loadSpeciesControlPage({
			listDirectory: item.lists,
			modelDirectory: item.model,
			settingsPath: item.config,
			database: item.database,
		});
		assert.equal(page.listFiles.whitelisted, false);
		assert.equal(
			page.rows.some((row) => row.whitelisted),
			false,
		);
	} finally {
		item.database.close();
	}
});

test("save writes canonical sorted lists, preserves unknowns, modes, and revision safety", async () => {
	const item = await fixture();
	try {
		const includePath = path.join(item.lists, "include_species_list.txt");
		await chmod(includePath, 0o640);
		const beforeMode = (await stat(includePath)).mode & 0o777;
		const page = await loadSpeciesControlPage({
			listDirectory: item.lists,
			modelDirectory: item.model,
			settingsPath: item.config,
			database: item.database,
		});
		const result = await saveSpeciesControlLists(
			{
				revision: page.revision,
				custom: ["Sciurus carolinensis", "Canis latrans"],
				excluded: [],
				whitelisted: ["Sciurus carolinensis"],
				removeUnresolved: [],
			},
			{
				listDirectory: item.lists,
				modelDirectory: item.model,
				settingsPath: item.config,
				database: item.database,
			},
		);
		assert.notEqual(result.revision, page.revision);
		assert.equal(
			await readFile(includePath, "utf8"),
			"Canis latrans_Coyote\nSciurus carolinensis_Eastern Gray Squirrel\n",
		);
		assert.equal(
			await readFile(path.join(item.lists, "exclude_species_list.txt"), "utf8"),
			"Stale species_Old name\n",
		);
		assert.equal((await stat(includePath)).mode & 0o777, beforeMode);
		await assert.rejects(
			saveSpeciesControlLists(
				{
					revision: page.revision,
					custom: [],
					excluded: [],
					whitelisted: [],
					removeUnresolved: [],
				},
				{
					listDirectory: item.lists,
					modelDirectory: item.model,
					settingsPath: item.config,
					database: item.database,
				},
			),
			/changed since this page was loaded/i,
		);
		assert.deepEqual((await readdir(item.lists)).sort(), [
			"exclude_species_list.txt",
			"include_species_list.txt",
			"whitelist_species_list.txt",
		]);
	} finally {
		item.database.close();
	}
});

test("save removes only explicitly named unresolved tokens", async () => {
	const item = await fixture();
	try {
		const dependencies = {
			listDirectory: item.lists,
			modelDirectory: item.model,
			settingsPath: item.config,
			database: item.database,
		};
		const page = await loadSpeciesControlPage(dependencies);
		await saveSpeciesControlLists(
			{
				revision: page.revision,
				custom: ["Canis latrans"],
				excluded: ["Sciurus carolinensis"],
				whitelisted: ["Canis latrans"],
				removeUnresolved: [{ list: "excluded", raw: "Stale species_Old name" }],
			},
			dependencies,
		);
		assert.equal(
			await readFile(path.join(item.lists, "exclude_species_list.txt"), "utf8"),
			"Sciurus carolinensis_Eastern Gray Squirrel\n",
		);
	} finally {
		item.database.close();
	}
});

test("save enforces exclusion precedence and keeps Always species in Custom scope", async () => {
	const item = await fixture();
	try {
		const dependencies = {
			listDirectory: item.lists,
			modelDirectory: item.model,
			settingsPath: item.config,
			database: item.database,
		};
		const page = await loadSpeciesControlPage(dependencies);
		await saveSpeciesControlLists(
			{
				revision: page.revision,
				custom: ["Canis latrans", "Sciurus carolinensis"],
				excluded: ["Sciurus carolinensis"],
				whitelisted: ["Canis latrans", "Sciurus carolinensis"],
				removeUnresolved: [],
			},
			dependencies,
		);
		assert.equal(
			await readFile(path.join(item.lists, "include_species_list.txt"), "utf8"),
			"Canis latrans_Coyote\n",
		);
		assert.equal(
			await readFile(
				path.join(item.lists, "whitelist_species_list.txt"),
				"utf8",
			),
			"Canis latrans_Coyote\n",
		);
	} finally {
		item.database.close();
	}
});

test("history deletion previews exact rows and removes reviews plus unshared assets", async () => {
	const item = await fixture();
	try {
		item.database.exec(
			"CREATE TABLE reviews (Date TEXT, Time TEXT, Com_Name TEXT, File_Name TEXT, action TEXT, confidence REAL, reviewed_at TEXT)",
		);
		item.database
			.prepare("INSERT INTO reviews VALUES (?, ?, ?, ?, ?, ?, ?)")
			.run(
				"2026-07-31",
				"01:00",
				"Coyote",
				"coyote-a.mp3",
				"confirmed",
				0.93,
				"2026-07-31T02:00:00Z",
			);
		const extractedRoot = path.join(item.root, "Extracted");
		for (const date of ["2026-07-30", "2026-07-31"]) {
			const directory = path.join(extractedRoot, "By_Date", date, "Coyote");
			await mkdir(directory, { recursive: true });
			await writeFile(path.join(directory, "coyote-a.mp3"), "audio");
			await writeFile(path.join(directory, "coyote-a.mp3.png"), "image");
		}
		const dependencies = {
			listDirectory: item.lists,
			modelDirectory: item.model,
			settingsPath: item.config,
			database: item.database,
			extractedRoot,
		};
		assert.deepEqual(
			await previewSpeciesHistoryDeletion("Canis latrans", dependencies),
			{
				sciName: "Canis latrans",
				comName: "Coyote",
				rows: 2,
				recordings: 2,
				assets: 4,
			},
		);
		const result = await deleteSpeciesHistory(
			{ sciName: "Canis latrans", expectedRows: 2 },
			dependencies,
		);
		assert.deepEqual(result, {
			deletedRows: 2,
			deletedAssets: 4,
			missingAssets: 0,
			failedAssets: 0,
		});
		assert.equal(
			item.database
				.prepare(
					"SELECT COUNT(*) n FROM detections WHERE Sci_Name='Canis latrans'",
				)
				.get()?.n,
			0,
		);
		assert.equal(
			item.database.prepare("SELECT COUNT(*) n FROM reviews").get()?.n,
			0,
		);
	} finally {
		item.database.close();
	}
});

test("history deletion refuses changed counts and unsupported species", async () => {
	const item = await fixture();
	try {
		const dependencies = {
			listDirectory: item.lists,
			modelDirectory: item.model,
			settingsPath: item.config,
			database: item.database,
			extractedRoot: path.join(item.root, "Extracted"),
		};
		await assert.rejects(
			deleteSpeciesHistory(
				{ sciName: "Canis latrans", expectedRows: 1 },
				dependencies,
			),
			/changed since the preview/i,
		);
		assert.equal(
			item.database
				.prepare(
					"SELECT COUNT(*) n FROM detections WHERE Sci_Name='Canis latrans'",
				)
				.get()?.n,
			2,
		);
		await assert.rejects(
			previewSpeciesHistoryDeletion("Didelphis virginiana", dependencies),
			/not available in the installed model/i,
		);
	} finally {
		item.database.close();
	}
});
