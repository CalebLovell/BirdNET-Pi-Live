import "@tanstack/react-start/server-only";

import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";

import * as schema from "./schema.ts";

// BirdNET-Pi's own scripts (birdnet_analysis.py, createdb.sh, etc.) own the
// database — this app only ever reads from it. We use Node's built-in
// node:sqlite (no native build step / prebuilt-binary download required,
// which matters for portability to a Raspberry Pi) via drizzle's
// sqlite-proxy driver, which just needs a callback that runs raw SQL.
const dbPath = process.env.BIRDNET_DB_PATH ?? "../scripts/birds.db";

// Matches scripts/createdb.sh exactly, so a freshly-created fallback database
// (see below) has the same shape as a real BirdNET-Pi install.
const CREATE_DETECTIONS_TABLE = `
CREATE TABLE IF NOT EXISTS detections (
  Date DATE,
  Time TIME,
  Sci_Name VARCHAR(100) NOT NULL,
  Com_Name VARCHAR(100) NOT NULL,
  Confidence FLOAT,
  Lat FLOAT,
  Lon FLOAT,
  Cutoff FLOAT,
  Week INT,
  Sens FLOAT,
  Overlap FLOAT,
  File_Name VARCHAR(100) NOT NULL
);
CREATE INDEX IF NOT EXISTS "detections_Com_Name" ON "detections" ("Com_Name");
CREATE INDEX IF NOT EXISTS "detections_Sci_Name" ON "detections" ("Sci_Name");
CREATE INDEX IF NOT EXISTS "detections_Date_Time" ON "detections" ("Date" DESC, "Time" DESC);
`;

function openDetectionsDb(): DatabaseSync {
	try {
		return new DatabaseSync(dbPath, { readOnly: true });
	} catch {
		// Falls back to a writable local file with the same schema BirdNET-Pi's
		// createdb.sh creates, so `npm run dev`/`build` still work before the
		// real birds.db exists (fresh checkout, CI, etc). Point BIRDNET_DB_PATH
		// at the real database in production, where this branch is never hit.
		const fallback = new DatabaseSync(dbPath, { readOnly: false });
		fallback.exec(CREATE_DETECTIONS_TABLE);
		return fallback;
	}
}

export const sqlite = openDetectionsDb();

export const db = drizzle(
	async (sql, params, method) => {
		const stmt = sqlite.prepare(sql);
		if (method === "run") {
			stmt.run(...params);
			return { rows: [] };
		}
		if (method === "get") {
			const row = stmt.get(...params) as Record<string, unknown> | undefined;
			return { rows: row ? [Object.values(row)] : [] };
		}
		// 'all' | 'values'
		const rows = stmt.all(...params) as Record<string, unknown>[];
		return { rows: rows.map((row) => Object.values(row)) };
	},
	{ schema },
);
