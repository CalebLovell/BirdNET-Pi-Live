import "@tanstack/react-start/server-only";

import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
	access,
	chmod,
	mkdir,
	readFile,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";
import { resolveDetectionClipPath } from "./detection-file-path.server.ts";
import {
	parseBirdnetConfig,
	resolveSettingsPath,
} from "./settings-config.server.ts";
import type {
	HistoryDeletePreview,
	HistoryDeleteResult,
	SpeciesControlPageData,
	SpeciesControlRow,
	SpeciesControlSaveInput,
	SpeciesHistorySummary,
	SpeciesListName,
	SpeciesRangePreview,
} from "./species-control-data.ts";
import {
	normalizeSpeciesControlSave,
	speciesControlDeletePreviewSchema,
	speciesControlDeleteSchema,
} from "./species-control-data.ts";

export type InstalledSpecies = { sciName: string; comName: string };

type SpeciesControlDependencies = {
	listDirectory?: string;
	modelDirectory?: string;
	settingsPath?: string;
	database?: DatabaseSync;
	databasePath?: string;
	previewScriptPath?: string;
	now?: Date;
	runner?: PreviewRunner;
	extractedRoot?: string;
};

type PreviewRunner = (
	executable: string,
	args: string[],
	options: { timeout: number; env: NodeJS.ProcessEnv },
) => Promise<{ stdout: string }>;

const execFileAsync = promisify(execFile);
const defaultPreviewRunner: PreviewRunner = async (
	executable,
	args,
	options,
) => {
	const result = await execFileAsync(executable, args, {
		timeout: options.timeout,
		env: options.env,
		windowsHide: true,
	});
	return { stdout: result.stdout };
};

const LIST_FILES: Record<SpeciesListName, string> = {
	custom: "include_species_list.txt",
	excluded: "exclude_species_list.txt",
	whitelisted: "whitelist_species_list.txt",
};

const DEFAULT_MODEL = "BirdNET_GLOBAL_6K_V2.4_Model_FP16";

export function resolveSpeciesListDirectory(): string {
	return (
		process.env.BIRDNET_SPECIES_LIST_DIR ?? path.join(homedir(), "BirdNET-Pi")
	);
}

export function resolveSpeciesModelDirectory(): string {
	return (
		process.env.BIRDNET_MODEL_DIR ?? path.resolve(process.cwd(), "../model")
	);
}

async function readTextIfPresent(filePath: string) {
	try {
		return { exists: true, text: await readFile(filePath, "utf8") };
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return { exists: false, text: "" };
		}
		throw error;
	}
}

async function configuredModel(settingsPath: string) {
	try {
		const values = parseBirdnetConfig(await readFile(settingsPath, "utf8"));
		return values.MODEL?.trim() || DEFAULT_MODEL;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT")
			return DEFAULT_MODEL;
		throw error;
	}
}

export async function loadInstalledSpeciesCatalog(
	dependencies: SpeciesControlDependencies = {},
): Promise<InstalledSpecies[]> {
	const modelDirectory =
		dependencies.modelDirectory ?? resolveSpeciesModelDirectory();
	const settingsPath = dependencies.settingsPath ?? resolveSettingsPath();
	const model = await configuredModel(settingsPath);
	const [labelsText, localizedText] = await Promise.all([
		readFile(path.join(modelDirectory, `${model}_Labels.txt`), "utf8"),
		readFile(path.join(modelDirectory, "l18n", "labels_en.json"), "utf8"),
	]);
	const localized = JSON.parse(localizedText) as Record<string, unknown>;
	const seen = new Set<string>();
	const result: InstalledSpecies[] = [];
	for (const raw of labelsText.split(/\r?\n/)) {
		const label = raw.trim();
		const separator = label.indexOf("_");
		const legacyScientific = separator > 0 ? label.slice(0, separator) : "";
		const sciName =
			typeof localized[label] === "string"
				? label
				: typeof localized[legacyScientific] === "string"
					? legacyScientific
					: label;
		const comName = localized[sciName];
		if (!sciName || typeof comName !== "string" || !comName.trim()) continue;
		if (seen.has(sciName)) continue;
		seen.add(sciName);
		result.push({ sciName, comName: comName.trim() });
	}
	return result.sort(
		(a, b) =>
			a.comName.localeCompare(b.comName) || a.sciName.localeCompare(b.sciName),
	);
}

export function parseSpeciesList(
	text: string,
	catalog: InstalledSpecies[],
): { known: string[]; unresolved: string[] } {
	const knownNames = new Set(catalog.map((item) => item.sciName));
	const known: string[] = [];
	const unresolved: string[] = [];
	const seenKnown = new Set<string>();
	const seenRaw = new Set<string>();
	for (const line of text.split(/\r?\n/)) {
		const raw = line.trim();
		if (!raw) continue;
		let sciName = knownNames.has(raw) ? raw : null;
		if (!sciName) {
			const separator = raw.indexOf("_");
			const candidate = separator > 0 ? raw.slice(0, separator) : "";
			if (knownNames.has(candidate)) sciName = candidate;
		}
		if (sciName) {
			if (!seenKnown.has(sciName)) known.push(sciName);
			seenKnown.add(sciName);
		} else if (!seenRaw.has(raw)) {
			unresolved.push(raw);
			seenRaw.add(raw);
		}
	}
	return { known, unresolved };
}

type LoadedLists = {
	parsed: Record<SpeciesListName, ReturnType<typeof parseSpeciesList>>;
	files: Record<SpeciesListName, { exists: boolean; text: string }>;
	revision: string;
};

async function loadLists(
	listDirectory: string,
	catalog: InstalledSpecies[],
): Promise<LoadedLists> {
	const entries = await Promise.all(
		(Object.entries(LIST_FILES) as [SpeciesListName, string][]).map(
			async ([name, fileName]) =>
				[
					name,
					await readTextIfPresent(path.join(listDirectory, fileName)),
				] as const,
		),
	);
	const files = Object.fromEntries(entries) as LoadedLists["files"];
	const hash = createHash("sha256");
	for (const name of Object.keys(LIST_FILES) as SpeciesListName[]) {
		hash.update(name);
		hash.update("\0");
		hash.update(files[name].exists ? "1" : "0");
		hash.update("\0");
		hash.update(files[name].text);
		hash.update("\0");
	}
	return {
		files,
		revision: hash.digest("hex"),
		parsed: Object.fromEntries(
			(Object.keys(LIST_FILES) as SpeciesListName[]).map((name) => [
				name,
				parseSpeciesList(files[name].text, catalog),
			]),
		) as LoadedLists["parsed"],
	};
}

type HistoryRow = {
	sciName: string;
	detections: number;
	maxConfidence: number | null;
	lastSeen: string | null;
	recordings: number;
};

function historyBySpecies(
	database: DatabaseSync,
): Map<string, SpeciesHistorySummary> {
	const rows = database
		.prepare(
			`SELECT Sci_Name sciName,
			 COUNT(*) detections,
			 MAX(Confidence) maxConfidence,
			 MAX(Date || 'T' || Time) lastSeen,
			 COUNT(DISTINCT Date || char(0) || Com_Name || char(0) || File_Name) recordings
			 FROM detections GROUP BY Sci_Name`,
		)
		.all() as HistoryRow[];
	return new Map(
		rows.map((row) => [
			row.sciName,
			{
				detections: Number(row.detections),
				maxConfidence:
					row.maxConfidence === null ? null : Number(row.maxConfidence),
				lastSeen: row.lastSeen,
				recordings: Number(row.recordings),
			},
		]),
	);
}

function openHistoryDatabase(dependencies: SpeciesControlDependencies) {
	if (dependencies.database) {
		return { database: dependencies.database, owned: false };
	}
	const databasePath =
		dependencies.databasePath ??
		process.env.BIRDNET_DB_PATH ??
		path.resolve(process.cwd(), "../scripts/birds.db");
	return {
		database: new DatabaseSync(databasePath, { readOnly: true }),
		owned: true,
	};
}

export async function loadSpeciesControlPage(
	dependencies: SpeciesControlDependencies = {},
): Promise<SpeciesControlPageData> {
	const listDirectory =
		dependencies.listDirectory ?? resolveSpeciesListDirectory();
	const catalog = await loadInstalledSpeciesCatalog(dependencies);
	const lists = await loadLists(listDirectory, catalog);
	let history = new Map<string, SpeciesHistorySummary>();
	let opened: ReturnType<typeof openHistoryDatabase> | null = null;
	try {
		opened = openHistoryDatabase(dependencies);
		history = historyBySpecies(opened.database);
	} catch (error) {
		if (dependencies.database || dependencies.databasePath) throw error;
	} finally {
		if (opened?.owned) opened.database.close();
	}
	const memberships = {
		custom: new Set(lists.parsed.custom.known),
		excluded: new Set(lists.parsed.excluded.known),
		whitelisted: new Set(lists.parsed.whitelisted.known),
	};
	const emptyHistory: SpeciesHistorySummary = {
		detections: 0,
		maxConfidence: null,
		lastSeen: null,
		recordings: 0,
	};
	const rows: SpeciesControlRow[] = catalog.map((species) => ({
		...species,
		custom: memberships.custom.has(species.sciName),
		excluded: memberships.excluded.has(species.sciName),
		whitelisted: memberships.whitelisted.has(species.sciName),
		geographicallyEligible: null,
		probability: null,
		history: history.get(species.sciName) ?? emptyHistory,
	}));
	return {
		revision: lists.revision,
		rows,
		customMode: lists.parsed.custom.known.length > 0,
		unresolved: {
			custom: lists.parsed.custom.unresolved,
			excluded: lists.parsed.excluded.unresolved,
			whitelisted: lists.parsed.whitelisted.unresolved,
		},
		listFiles: {
			custom: lists.files.custom.exists,
			excluded: lists.files.excluded.exists,
			whitelisted: lists.files.whitelisted.exists,
		},
	};
}

let saveQueue: Promise<void> = Promise.resolve();

function withSaveLock<T>(operation: () => Promise<T>): Promise<T> {
	const result = saveQueue.then(operation, operation);
	saveQueue = result.then(
		() => undefined,
		() => undefined,
	);
	return result;
}

function serializeKnown(names: string[], catalog: InstalledSpecies[]) {
	const byScientific = new Map(catalog.map((item) => [item.sciName, item]));
	return names
		.map((name) => {
			const item = byScientific.get(name);
			if (!item) throw new Error(`Unsupported installed species: ${name}`);
			return `${item.sciName}_${item.comName}`;
		})
		.sort((a, b) => a.localeCompare(b));
}

async function replaceAllLists(
	listDirectory: string,
	contents: Record<SpeciesListName, string>,
) {
	await mkdir(listDirectory, { recursive: true });
	const token = `${process.pid}-${randomUUID()}`;
	const records = await Promise.all(
		(Object.entries(LIST_FILES) as [SpeciesListName, string][]).map(
			async ([name, fileName]) => {
				const target = path.join(listDirectory, fileName);
				const temporary = `${target}.tmp-${token}`;
				const backup = `${target}.bak-${token}`;
				let mode = 0o644;
				let existed = true;
				try {
					mode = (await stat(target)).mode;
				} catch (error) {
					if ((error as NodeJS.ErrnoException).code === "ENOENT")
						existed = false;
					else throw error;
				}
				await writeFile(temporary, contents[name], { encoding: "utf8", mode });
				await chmod(temporary, mode);
				return {
					target,
					temporary,
					backup,
					existed,
					backedUp: false,
					installed: false,
				};
			},
		),
	);
	try {
		for (const record of records) {
			if (record.existed) {
				await rename(record.target, record.backup);
				record.backedUp = true;
			}
			await rename(record.temporary, record.target);
			record.installed = true;
		}
	} catch (error) {
		const rollbackErrors: unknown[] = [];
		for (const record of [...records].reverse()) {
			try {
				if (record.installed) await rm(record.target, { force: true });
				if (record.backedUp) await rename(record.backup, record.target);
			} catch (rollbackError) {
				rollbackErrors.push(rollbackError);
			}
		}
		if (rollbackErrors.length) {
			throw new AggregateError(
				[error, ...rollbackErrors],
				"Species lists failed to save and could not be fully restored",
			);
		}
		throw error;
	} finally {
		await Promise.all(
			records.flatMap((record) => [
				rm(record.temporary, { force: true }),
				rm(record.backup, { force: true }),
			]),
		);
	}
}

export async function saveSpeciesControlLists(
	input: SpeciesControlSaveInput,
	dependencies: SpeciesControlDependencies = {},
): Promise<{ revision: string }> {
	const parsedInput = normalizeSpeciesControlSave(input);
	return withSaveLock(async () => {
		const listDirectory =
			dependencies.listDirectory ?? resolveSpeciesListDirectory();
		const catalog = await loadInstalledSpeciesCatalog(dependencies);
		const current = await loadLists(listDirectory, catalog);
		if (current.revision !== parsedInput.revision) {
			throw new Error(
				"Species lists changed since this page was loaded. Reload and review your changes.",
			);
		}
		const removals = new Map<SpeciesListName, Set<string>>(
			(Object.keys(LIST_FILES) as SpeciesListName[]).map((name) => [
				name,
				new Set(
					parsedInput.removeUnresolved
						.filter((entry) => entry.list === name)
						.map((entry) => entry.raw),
				),
			]),
		);
		const effectiveLists = {
			custom: new Set(parsedInput.custom),
			excluded: new Set(parsedInput.excluded),
			whitelisted: new Set(parsedInput.whitelisted),
		};
		// Enforce the runtime precedence on the privileged side too. A crafted
		// request cannot leave contradictory lines that the UI itself prevents.
		for (const sciName of effectiveLists.excluded) {
			effectiveLists.custom.delete(sciName);
			effectiveLists.whitelisted.delete(sciName);
		}
		if (effectiveLists.custom.size > 0) {
			for (const sciName of effectiveLists.whitelisted) {
				effectiveLists.custom.add(sciName);
			}
		}
		const contents = Object.fromEntries(
			(Object.keys(LIST_FILES) as SpeciesListName[]).map((name) => {
				const known = serializeKnown([...effectiveLists[name]], catalog);
				const unresolved = current.parsed[name].unresolved.filter(
					(raw) => !removals.get(name)?.has(raw),
				);
				const lines = [...known, ...unresolved];
				return [name, lines.length ? `${lines.join("\n")}\n` : ""];
			}),
		) as Record<SpeciesListName, string>;
		await replaceAllLists(listDirectory, contents);
		return { revision: (await loadLists(listDirectory, catalog)).revision };
	});
}

const rangePreviewCache = new Map<string, SpeciesRangePreview>();

function isoWeek(date: Date) {
	const utc = new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
	);
	const day = utc.getUTCDay() || 7;
	utc.setUTCDate(utc.getUTCDate() + 4 - day);
	const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
	return Math.ceil(
		((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
	);
}

function unavailableRange(message: string): SpeciesRangePreview {
	return {
		status: "unavailable",
		model: null,
		week: null,
		threshold: null,
		species: [],
		message,
	};
}

export async function previewSpeciesRange(
	dependencies: SpeciesControlDependencies = {},
): Promise<SpeciesRangePreview> {
	try {
		const settingsPath = dependencies.settingsPath ?? resolveSettingsPath();
		const modelDirectory =
			dependencies.modelDirectory ?? resolveSpeciesModelDirectory();
		const values = parseBirdnetConfig(await readFile(settingsPath, "utf8"));
		const model = values.MODEL?.trim();
		const latitude = Number(values.LATITUDE);
		const longitude = Number(values.LONGITUDE);
		const threshold = Number(values.SF_THRESH);
		const dataModelVersion = Number(values.DATA_MODEL_VERSION);
		if (
			!model ||
			!Number.isFinite(latitude) ||
			!Number.isFinite(longitude) ||
			!Number.isFinite(threshold) ||
			threshold < 0 ||
			threshold > 1 ||
			![1, 2].includes(dataModelVersion)
		) {
			return unavailableRange(
				"The configured model does not support a geographic preview.",
			);
		}
		const week = isoWeek(dependencies.now ?? new Date());
		const key = JSON.stringify({
			model,
			latitude,
			longitude,
			week,
			dataModelVersion,
			threshold,
			modelDirectory,
		});
		const cached = rangePreviewCache.get(key);
		if (cached) return cached;
		const scriptPath =
			dependencies.previewScriptPath ??
			path.resolve(process.cwd(), "../scripts/species.py");
		const runner = dependencies.runner ?? defaultPreviewRunner;
		const { stdout } = await runner(
			"python3",
			[scriptPath, "--json", "--threshold", String(threshold)],
			{
				timeout: 20_000,
				env: {
					...process.env,
					BIRDNET_CONF: settingsPath,
					BIRDNET_MODEL_DIR: modelDirectory,
				},
			},
		);
		const raw = JSON.parse(stdout) as Record<string, unknown>;
		if (
			raw.model !== model ||
			raw.week !== week ||
			raw.threshold !== threshold ||
			!Array.isArray(raw.species)
		) {
			throw new Error("Unexpected range preview payload");
		}
		const species = raw.species.map((entry) => {
			if (!entry || typeof entry !== "object")
				throw new Error("Invalid species");
			const row = entry as Record<string, unknown>;
			if (
				typeof row.sciName !== "string" ||
				typeof row.comName !== "string" ||
				typeof row.probability !== "number" ||
				!Number.isFinite(row.probability) ||
				row.probability < 0 ||
				row.probability > 1
			) {
				throw new Error("Invalid species range entry");
			}
			return {
				sciName: row.sciName,
				comName: row.comName,
				probability: row.probability,
			};
		});
		const preview: SpeciesRangePreview = {
			status: "available",
			model,
			week,
			threshold,
			species,
		};
		rangePreviewCache.set(key, preview);
		return preview;
	} catch {
		return unavailableRange(
			"A geographic preview could not be generated on this station right now.",
		);
	}
}

type DetectionAssetRow = {
	date: string;
	time: string;
	comName: string;
	fileName: string;
};

function openWritableHistoryDatabase(dependencies: SpeciesControlDependencies) {
	if (dependencies.database) {
		return { database: dependencies.database, owned: false };
	}
	const databasePath =
		dependencies.databasePath ??
		process.env.BIRDNET_DB_PATH ??
		path.resolve(process.cwd(), "../scripts/birds.db");
	return { database: new DatabaseSync(databasePath), owned: true };
}

async function requireInstalledSpecies(
	sciName: string,
	dependencies: SpeciesControlDependencies,
) {
	const parsed = speciesControlDeletePreviewSchema.parse({ sciName });
	const catalog = await loadInstalledSpeciesCatalog(dependencies);
	const species = catalog.find((item) => item.sciName === parsed.sciName);
	if (!species)
		throw new Error("Species is not available in the installed model");
	return species;
}

function detectionAssets(database: DatabaseSync, sciName: string) {
	return database
		.prepare(
			"SELECT Date date, Time time, Com_Name comName, File_Name fileName FROM detections WHERE Sci_Name=? ORDER BY Date, Time, Com_Name, File_Name",
		)
		.all(sciName) as DetectionAssetRow[];
}

function uniqueRecordings(rows: DetectionAssetRow[]) {
	const seen = new Set<string>();
	return rows.filter((row) => {
		const key = `${row.date}\0${row.comName}\0${row.fileName}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

async function pathExists(filePath: string) {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

function extractedRoot(dependencies: SpeciesControlDependencies) {
	return path.resolve(
		dependencies.extractedRoot ??
			process.env.BIRDNET_EXTRACTED_DIR ??
			"../../BirdSongs/Extracted",
	);
}

export async function previewSpeciesHistoryDeletion(
	sciName: string,
	dependencies: SpeciesControlDependencies = {},
): Promise<HistoryDeletePreview> {
	const species = await requireInstalledSpecies(sciName, dependencies);
	const opened = openHistoryDatabase(dependencies);
	try {
		const rows = detectionAssets(opened.database, sciName);
		const recordings = uniqueRecordings(rows);
		let assets = 0;
		for (const recording of recordings) {
			const filePath = resolveDetectionClipPath(extractedRoot(dependencies), {
				date: recording.date,
				commonName: recording.comName,
				fileName: recording.fileName,
			});
			if (!filePath) continue;
			if (await pathExists(filePath)) assets++;
			if (await pathExists(`${filePath}.png`)) assets++;
		}
		return {
			sciName,
			comName: species.comName,
			rows: rows.length,
			recordings: recordings.length,
			assets,
		};
	} finally {
		if (opened.owned) opened.database.close();
	}
}

function reviewsTableExists(database: DatabaseSync) {
	return (
		database
			.prepare(
				"SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name='reviews'",
			)
			.get() !== undefined
	);
}

export async function deleteSpeciesHistory(
	input: { sciName: string; expectedRows: number },
	dependencies: SpeciesControlDependencies = {},
): Promise<HistoryDeleteResult> {
	const parsed = speciesControlDeleteSchema.parse(input);
	await requireInstalledSpecies(parsed.sciName, dependencies);
	const opened = openWritableHistoryDatabase(dependencies);
	let recordings: DetectionAssetRow[] = [];
	let deletedRows = 0;
	try {
		opened.database.exec("BEGIN IMMEDIATE");
		try {
			const rows = detectionAssets(opened.database, parsed.sciName);
			if (rows.length !== parsed.expectedRows) {
				throw new Error(
					"Detection history changed since the preview. Preview it again before deleting.",
				);
			}
			recordings = uniqueRecordings(rows);
			if (reviewsTableExists(opened.database)) {
				const removeReview = opened.database.prepare(
					"DELETE FROM reviews WHERE Date=? AND Time=? AND Com_Name=? AND File_Name=?",
				);
				for (const row of rows) {
					removeReview.run(row.date, row.time, row.comName, row.fileName);
				}
			}
			deletedRows = Number(
				opened.database
					.prepare("DELETE FROM detections WHERE Sci_Name=?")
					.run(parsed.sciName).changes,
			);
			if (deletedRows !== parsed.expectedRows) {
				throw new Error("Detection history changed while it was being deleted");
			}
			opened.database.exec("COMMIT");
		} catch (error) {
			try {
				opened.database.exec("ROLLBACK");
			} catch {
				// The original error is more useful if SQLite already rolled back.
			}
			throw error;
		}

		let deletedAssets = 0;
		let missingAssets = 0;
		let failedAssets = 0;
		for (const recording of recordings) {
			const remaining = Number(
				opened.database
					.prepare(
						"SELECT COUNT(*) n FROM detections WHERE Date=? AND Com_Name=? AND File_Name=?",
					)
					.get(recording.date, recording.comName, recording.fileName)?.n ?? 0,
			);
			if (remaining > 0) continue;
			const filePath = resolveDetectionClipPath(extractedRoot(dependencies), {
				date: recording.date,
				commonName: recording.comName,
				fileName: recording.fileName,
			});
			if (!filePath) {
				failedAssets += 2;
				continue;
			}
			for (const asset of [filePath, `${filePath}.png`]) {
				try {
					await rm(asset);
					deletedAssets++;
				} catch (error) {
					if ((error as NodeJS.ErrnoException).code === "ENOENT")
						missingAssets++;
					else failedAssets++;
				}
			}
		}
		return {
			deletedRows,
			deletedAssets,
			missingAssets,
			failedAssets,
		};
	} finally {
		if (opened.owned) opened.database.close();
	}
}
