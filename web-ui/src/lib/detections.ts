import { rm } from "node:fs/promises";
import { createServerFn } from "@tanstack/react-start";
import {
	and,
	asc,
	count,
	countDistinct,
	desc,
	gte,
	like,
	lte,
	sql,
} from "drizzle-orm";
import { db, openWritableDetectionsDb } from "~/db/index.ts";
import { type Detection, detections } from "~/db/schema.ts";
import { extractedDir } from "~/lib/audio.server.ts";
import { audioUrlFor } from "~/lib/audio.ts";
import {
	type DetectionClipIdentity,
	resolveDetectionClipPath,
} from "~/lib/detection-file-path.server.ts";
import {
	type DetectionWorkspaceSearch,
	normalizeDetectionWorkspaceSearch,
} from "~/lib/detection-workspace.ts";
import { ebirdUrlFor } from "~/lib/ebird.ts";
import { illustrationUrlFor } from "~/lib/illustrations.ts";
import { getSpeciesInfo } from "~/lib/wikipedia.ts";

const isToday = sql`${detections.Date} = date('now', 'localtime')`;
const isLastHour = sql`datetime(${detections.Date} || ' ' || ${detections.Time}) >= datetime('now', '-1 hour', 'localtime')`;

export type DetectionStats = {
	total: number;
	today: number;
	lastHour: number;
	speciesToday: number;
	speciesAllTime: number;
};

export const getDetectionStats = createServerFn({ method: "GET" }).handler(
	async (): Promise<DetectionStats> => {
		const [{ total }] = await db.select({ total: count() }).from(detections);
		const [{ today }] = await db
			.select({ today: count() })
			.from(detections)
			.where(isToday);
		const [{ lastHour }] = await db
			.select({ lastHour: count() })
			.from(detections)
			.where(isLastHour);
		const [{ speciesToday }] = await db
			.select({ speciesToday: countDistinct(detections.Com_Name) })
			.from(detections)
			.where(isToday);
		const [{ speciesAllTime }] = await db
			.select({ speciesAllTime: countDistinct(detections.Com_Name) })
			.from(detections);

		return { total, today, lastHour, speciesToday, speciesAllTime };
	},
);

export const getRecentDetections = createServerFn({ method: "GET" }).handler(
	async (): Promise<Detection[]> => {
		return db
			.select()
			.from(detections)
			.orderBy(desc(detections.Date), desc(detections.Time))
			.limit(50);
	},
);

export const getDetections = createServerFn({ method: "GET" }).handler(
	async (): Promise<Detection[]> => {
		return db
			.select()
			.from(detections)
			.orderBy(desc(detections.Date), desc(detections.Time))
			.limit(200);
	},
);

export type DetectionTableRow = Detection & {
	rowId: number;
};

export type DetectionPage = {
	rows: DetectionTableRow[];
	total: number;
};

function detectionFilters(search: DetectionWorkspaceSearch) {
	const filters = [];
	if (search.species) {
		filters.push(like(detections.Com_Name, `%${search.species}%`));
	}
	if (search.minConfidence !== undefined) {
		filters.push(gte(detections.Confidence, search.minConfidence));
	}
	if (search.from) filters.push(gte(detections.Date, search.from));
	if (search.to) filters.push(lte(detections.Date, search.to));
	return filters.length > 0 ? and(...filters) : undefined;
}

function detectionOrder(
	search: DetectionWorkspaceSearch,
): ReturnType<typeof asc>[] {
	const order = search.direction === "asc" ? asc : desc;
	switch (search.sort) {
		case "species":
			return [
				order(detections.Com_Name),
				order(detections.Date),
				order(detections.Time),
			];
		case "scientific":
			return [
				order(detections.Sci_Name),
				order(detections.Date),
				order(detections.Time),
			];
		case "confidence":
			return [
				order(detections.Confidence),
				order(detections.Date),
				order(detections.Time),
			];
		default:
			return [order(detections.Date), order(detections.Time)];
	}
}

export const getDetectionsPage = createServerFn({ method: "GET" })
	.validator((input: Record<string, unknown>) =>
		normalizeDetectionWorkspaceSearch(input),
	)
	.handler(async ({ data }): Promise<DetectionPage> => {
		const filters = detectionFilters(data);
		const [{ total }] = await db
			.select({ total: count() })
			.from(detections)
			.where(filters);
		const rows = await db
			.select({
				rowId: sql<number>`rowid`,
				Date: detections.Date,
				Time: detections.Time,
				Sci_Name: detections.Sci_Name,
				Com_Name: detections.Com_Name,
				Confidence: detections.Confidence,
				Lat: detections.Lat,
				Lon: detections.Lon,
				Cutoff: detections.Cutoff,
				Week: detections.Week,
				Sens: detections.Sens,
				Overlap: detections.Overlap,
				File_Name: detections.File_Name,
			})
			.from(detections)
			.where(filters)
			.orderBy(...detectionOrder(data))
			.limit(data.pageSize)
			.offset((data.page - 1) * data.pageSize);

		return { rows, total };
	});

type DeletionRequest = {
	rowIds: number[];
};

export type DeleteDetectionsResult = {
	deletedRecords: number;
	deletedFiles: number;
	missingFiles: number;
	failedFiles: number;
};

type SelectedDetection = DetectionClipIdentity & {
	rowId: number;
};

function validRowIds(rowIds: number[]): number[] {
	return [
		...new Set(
			rowIds.filter((rowId) => Number.isSafeInteger(rowId) && rowId > 0),
		),
	];
}

function readSelectedDetections(rowIds: number[]): SelectedDetection[] {
	const writable = openWritableDetectionsDb();
	const placeholders = rowIds.map(() => "?").join(", ");
	try {
		writable.exec("BEGIN IMMEDIATE");
		const selected = writable
			.prepare(
				`SELECT rowid AS rowId, Date AS date, Com_Name AS commonName, File_Name AS fileName FROM detections WHERE rowid IN (${placeholders})`,
			)
			.all(...rowIds) as SelectedDetection[];
		writable
			.prepare(`DELETE FROM detections WHERE rowid IN (${placeholders})`)
			.run(...rowIds);
		writable.exec("COMMIT");
		return selected;
	} catch (error) {
		try {
			writable.exec("ROLLBACK");
		} catch {
			// The transaction may not have started if opening or preparation failed.
		}
		throw error;
	} finally {
		writable.close();
	}
}

async function deleteUnreferencedClips(
	selected: SelectedDetection[],
): Promise<Omit<DeleteDetectionsResult, "deletedRecords">> {
	const uniqueClips = new Map<string, DetectionClipIdentity>();
	for (const clip of selected) {
		uniqueClips.set(
			`${clip.date}\u0000${clip.commonName}\u0000${clip.fileName}`,
			clip,
		);
	}

	let deletedFiles = 0;
	let missingFiles = 0;
	let failedFiles = 0;
	for (const clip of uniqueClips.values()) {
		const [{ references }] = await db
			.select({ references: count() })
			.from(detections)
			.where(
				and(
					sql`${detections.Date} = ${clip.date}`,
					sql`${detections.Com_Name} = ${clip.commonName}`,
					sql`${detections.File_Name} = ${clip.fileName}`,
				),
			);
		if (references > 0) continue;

		const filePath = resolveDetectionClipPath(extractedDir(), clip);
		if (!filePath) {
			failedFiles += 1;
			continue;
		}

		try {
			await rm(filePath);
			deletedFiles += 1;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				missingFiles += 1;
			} else {
				failedFiles += 1;
			}
		}
	}

	return { deletedFiles, missingFiles, failedFiles };
}

export const deleteDetections = createServerFn({ method: "POST" })
	.validator((input: DeletionRequest) => ({
		rowIds: validRowIds(input.rowIds),
	}))
	.handler(async ({ data }): Promise<DeleteDetectionsResult> => {
		if (data.rowIds.length === 0) {
			return {
				deletedRecords: 0,
				deletedFiles: 0,
				missingFiles: 0,
				failedFiles: 0,
			};
		}

		const selected = readSelectedDetections(data.rowIds);
		const fileResults = await deleteUnreferencedClips(selected);
		return { deletedRecords: selected.length, ...fileResults };
	});

export type LifeListCard = {
	comName: string;
	sciName: string;
	allTimeCount: number;
	lastDetected: string;
	audioUrl: string | null;
	imageUrl: string | null;
	ebirdUrl: string;
};

export const getLifeListCards = createServerFn({ method: "GET" }).handler(
	async (): Promise<LifeListCard[]> => {
		const totals = await db
			.select({
				comName: detections.Com_Name,
				sciName: detections.Sci_Name,
				allTimeCount: count(),
			})
			.from(detections)
			.groupBy(detections.Com_Name, detections.Sci_Name);

		// Most-recent detection per species, ordered so the first occurrence
		// of each Com_Name we see is the latest one.
		const recent = await db
			.select({
				comName: detections.Com_Name,
				date: detections.Date,
				time: detections.Time,
				fileName: detections.File_Name,
			})
			.from(detections)
			.orderBy(desc(detections.Date), desc(detections.Time));
		const latestByName = new Map<
			string,
			{ date: string; time: string; fileName: string }
		>();
		for (const row of recent) {
			if (!latestByName.has(row.comName)) {
				latestByName.set(row.comName, row);
			}
		}

		return Promise.all(
			totals.map(async (row) => {
				const latest = latestByName.get(row.comName);
				const { imageUrl: wikiImageUrl } = await getSpeciesInfo(row.comName);
				return {
					comName: row.comName,
					sciName: row.sciName,
					allTimeCount: row.allTimeCount,
					lastDetected: latest ? `${latest.date} ${latest.time}` : "",
					audioUrl: latest
						? audioUrlFor(latest.date, row.comName, latest.fileName)
						: null,
					imageUrl: illustrationUrlFor(row.sciName) ?? wikiImageUrl,
					ebirdUrl: ebirdUrlFor(row.sciName, row.comName),
				};
			}),
		);
	},
);
