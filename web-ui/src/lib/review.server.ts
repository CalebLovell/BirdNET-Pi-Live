import "@tanstack/react-start/server-only";

import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

import { audioUrlFor } from "~/lib/audio.ts";
import { resolveDetectionClipPath } from "~/lib/detection-file-path.server.ts";
import { ebirdUrlFor } from "~/lib/ebird.ts";
import {
	parseSpeciesCatalog,
	type ReviewSearch,
	recategorizedFileName,
	type SpeciesOption,
} from "~/lib/review-data.ts";

export type ReviewCandidate = {
	rowId: number;
	date: string;
	time: string;
	sciName: string;
	comName: string;
	confidence: number | null;
	fileName: string;
	lifetimeCount: number;
	audioUrl: string;
	audioAvailable: boolean;
	ebirdUrl: string;
};
export type ReviewPage = {
	queue: ReviewSearch["queue"];
	limit: number;
	rareTotal: number;
	lowConfidenceTotal: number;
	candidates: ReviewCandidate[];
};

type ReviewFileOperations = {
	copyFile: typeof copyFile;
	mkdir: typeof mkdir;
	rename: typeof rename;
	rm: typeof rm;
};

const defaultFileOperations: ReviewFileOperations = {
	copyFile,
	mkdir,
	rename,
	rm,
};

type RawCandidate = {
	rowId: number;
	date: string;
	time: string;
	sciName: string;
	comName: string;
	confidence: number | null;
	fileName: string;
	lifetimeCount: number;
};

export function loadReviewPage(
	database: DatabaseSync,
	extractedRoot: string,
	search: ReviewSearch,
): ReviewPage {
	const eligible = "Confidence IS NULL OR Confidence < 1.0";
	const rareTotal = Number(
		database
			.prepare(
				`SELECT COUNT(*) AS n FROM (SELECT 1 FROM detections WHERE ${eligible} GROUP BY Sci_Name, Com_Name)`,
			)
			.get()?.n ?? 0,
	);
	const lowConfidenceTotal = Number(
		database
			.prepare(`SELECT COUNT(*) AS n FROM detections WHERE ${eligible}`)
			.get()?.n ?? 0,
	);
	const rareSql = `WITH lifetime AS (SELECT Sci_Name, Com_Name, COUNT(*) lifetime_count FROM detections GROUP BY Sci_Name, Com_Name), ranked AS (SELECT d.rowid rowId, d.Date date, d.Time time, d.Sci_Name sciName, d.Com_Name comName, d.Confidence confidence, d.File_Name fileName, lifetime.lifetime_count lifetimeCount, ROW_NUMBER() OVER (PARTITION BY d.Sci_Name, d.Com_Name ORDER BY d.Confidence IS NOT NULL, d.Confidence ASC, d.Date DESC, d.Time DESC) candidate_rank FROM detections d JOIN lifetime ON lifetime.Sci_Name=d.Sci_Name AND lifetime.Com_Name=d.Com_Name WHERE d.Confidence IS NULL OR d.Confidence < 1.0) SELECT rowId,date,time,sciName,comName,confidence,fileName,lifetimeCount FROM ranked WHERE candidate_rank=1 ORDER BY lifetimeCount ASC, comName ASC LIMIT ?`;
	const lowSql = `SELECT d.rowid rowId,d.Date date,d.Time time,d.Sci_Name sciName,d.Com_Name comName,d.Confidence confidence,d.File_Name fileName,(SELECT COUNT(*) FROM detections x WHERE x.Sci_Name=d.Sci_Name AND x.Com_Name=d.Com_Name) lifetimeCount FROM detections d WHERE ${eligible} ORDER BY d.Confidence IS NOT NULL, d.Confidence ASC, d.Date DESC, d.Time DESC LIMIT ?`;
	const rows = database
		.prepare(search.queue === "rare" ? rareSql : lowSql)
		.all(search.limit) as RawCandidate[];
	return {
		queue: search.queue,
		limit: search.limit,
		rareTotal,
		lowConfidenceTotal,
		candidates: rows.map((row) => {
			const clip = {
				date: row.date,
				commonName: row.comName,
				fileName: row.fileName,
			};
			const filePath = resolveDetectionClipPath(extractedRoot, clip);
			return {
				...row,
				audioUrl: audioUrlFor(row.date, row.comName, row.fileName),
				audioAvailable: filePath !== null && existsSync(filePath),
				ebirdUrl: ebirdUrlFor(row.sciName, row.comName),
			};
		}),
	};
}

export function loadSpeciesCatalog(labelsPath?: string): SpeciesOption[] {
	const configured = labelsPath ?? process.env.BIRDNET_LABELS_PATH;
	const jsonPath = path.resolve(process.cwd(), "../model/l18n/labels_en.json");
	if (configured && existsSync(configured)) {
		const text = readFileSync(configured, "utf8");
		if (text.trimStart().startsWith("{")) return parseSpeciesCatalog(text);
		return text
			.split(/\r?\n/)
			.flatMap((line) => {
				const separator = line.indexOf("_");
				return separator > 0
					? [
							{
								sciName: line.slice(0, separator),
								comName: line.slice(separator + 1),
							},
						]
					: [];
			})
			.sort((a, b) => a.comName.localeCompare(b.comName));
	}
	return parseSpeciesCatalog(readFileSync(jsonPath, "utf8"));
}

function target(database: DatabaseSync, rowId: number) {
	if (!Number.isSafeInteger(rowId) || rowId < 1)
		throw new Error("Invalid detection");
	const row = database
		.prepare(
			"SELECT rowid rowId, Date date, Time time, Sci_Name sciName, Com_Name comName, Confidence confidence, File_Name fileName FROM detections WHERE rowid=?",
		)
		.get(rowId);
	if (!row) throw new Error("Detection not found");
	return row as {
		rowId: number;
		date: string;
		time: string;
		sciName: string;
		comName: string;
		confidence: number | null;
		fileName: string;
	};
}

export function correctDetection(database: DatabaseSync, rowId: number) {
	target(database, rowId);
	const result = database
		.prepare("UPDATE detections SET Confidence=1.0 WHERE rowid=?")
		.run(rowId);
	if (result.changes !== 1) throw new Error("Detection was not updated");
}

export async function recategorizeDetection(
	database: DatabaseSync,
	extractedRoot: string,
	rowId: number,
	species: SpeciesOption,
	catalog: SpeciesOption[],
	files: ReviewFileOperations = defaultFileOperations,
) {
	if (
		!catalog.some(
			(item) =>
				item.sciName === species.sciName && item.comName === species.comName,
		)
	)
		throw new Error("Unsupported species");
	const row = target(database, rowId);
	const fileName = recategorizedFileName(
		row.fileName,
		row.comName,
		species.comName,
	);
	if (!fileName)
		throw new Error("Recording filename cannot be recategorized safely");
	const oldPath = resolveDetectionClipPath(extractedRoot, {
		date: row.date,
		commonName: row.comName,
		fileName: row.fileName,
	});
	const newPath = resolveDetectionClipPath(extractedRoot, {
		date: row.date,
		commonName: species.comName,
		fileName,
	});
	if (!oldPath || !newPath || !existsSync(oldPath))
		throw new Error("Recording audio is unavailable");
	if (existsSync(newPath) || existsSync(`${newPath}.png`))
		throw new Error("Replacement recording already exists");
	const references = Number(
		database
			.prepare(
				"SELECT COUNT(*) n FROM detections WHERE Date=? AND Com_Name=? AND File_Name=?",
			)
			.get(row.date, row.comName, row.fileName)?.n ?? 0,
	);
	const shared = references > 1;
	const hasImage = existsSync(`${oldPath}.png`);
	let audioPlaced = false;
	let imagePlaced = false;
	await files.mkdir(path.dirname(newPath), { recursive: true });
	try {
		if (shared) await files.copyFile(oldPath, newPath);
		else await files.rename(oldPath, newPath);
		audioPlaced = true;
		if (hasImage) {
			if (shared) await files.copyFile(`${oldPath}.png`, `${newPath}.png`);
			else await files.rename(`${oldPath}.png`, `${newPath}.png`);
			imagePlaced = true;
		}
		const result = database
			.prepare(
				"UPDATE detections SET Sci_Name=?, Com_Name=?, File_Name=?, Confidence=1.0 WHERE rowid=?",
			)
			.run(species.sciName, species.comName, fileName, rowId);
		if (result.changes !== 1) throw new Error("Detection was not updated");
	} catch (error) {
		const rollbackErrors: unknown[] = [];
		if (imagePlaced)
			try {
				if (shared) await files.rm(`${newPath}.png`, { force: true });
				else await files.rename(`${newPath}.png`, `${oldPath}.png`);
			} catch (rollbackError) {
				rollbackErrors.push(rollbackError);
			}
		if (audioPlaced)
			try {
				if (shared) await files.rm(newPath, { force: true });
				else await files.rename(newPath, oldPath);
			} catch (rollbackError) {
				rollbackErrors.push(rollbackError);
			}
		if (rollbackErrors.length > 0)
			throw new AggregateError(
				[error, ...rollbackErrors],
				"Recategorization failed and assets could not be fully restored",
			);
		throw error;
	}
}

export async function deleteDetectionDirectly(
	database: DatabaseSync,
	extractedRoot: string,
	rowId: number,
) {
	const row = target(database, rowId);
	const result = database
		.prepare("DELETE FROM detections WHERE rowid=?")
		.run(rowId);
	const references = Number(
		database
			.prepare(
				"SELECT COUNT(*) n FROM detections WHERE Date=? AND Com_Name=? AND File_Name=?",
			)
			.get(row.date, row.comName, row.fileName)?.n ?? 0,
	);
	let deletedFiles = 0,
		missingFiles = 0,
		failedFiles = 0;
	if (references === 0) {
		const filePath = resolveDetectionClipPath(extractedRoot, {
			date: row.date,
			commonName: row.comName,
			fileName: row.fileName,
		});
		if (!filePath) failedFiles++;
		else
			for (const asset of [filePath, `${filePath}.png`])
				try {
					await rm(asset);
					deletedFiles++;
				} catch (error) {
					if ((error as NodeJS.ErrnoException).code === "ENOENT")
						missingFiles++;
					else failedFiles++;
				}
	}
	return {
		deletedRecords: Number(result.changes),
		deletedFiles,
		missingFiles,
		failedFiles,
	};
}
