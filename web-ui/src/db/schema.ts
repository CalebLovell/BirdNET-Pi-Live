import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Mirrors the `detections` table created by BirdNET-Pi's scripts/createdb.sh.
// This app treats the database as read-only: BirdNET-Pi's own analysis
// pipeline (scripts/birdnet_analysis.py) is what writes new rows.
export const detections = sqliteTable("detections", {
	Date: text("Date").notNull(),
	Time: text("Time").notNull(),
	Sci_Name: text("Sci_Name").notNull(),
	Com_Name: text("Com_Name").notNull(),
	Confidence: real("Confidence"),
	Lat: real("Lat"),
	Lon: real("Lon"),
	Cutoff: real("Cutoff"),
	Week: integer("Week"),
	Sens: real("Sens"),
	Overlap: real("Overlap"),
	File_Name: text("File_Name").notNull(),
});

export type Detection = typeof detections.$inferSelect;

// Ours, not BirdNET-Pi's -- the one table this app creates and writes. It holds
// the review page's sign-offs, which cannot live on `detections` because both
// writers of that table (scripts/utils/reporting.py, scripts/seed_test_data.py)
// INSERT positionally with no column list: a thirteenth column would stop the
// station recording. Created on demand by ensureReviewsTable() in
// lib/review.server.ts, so a station that has never reviewed anything never
// grows it. Keyed on the detection's identity rather than its rowid, which
// SQLite recycles after deletes.
export const reviews = sqliteTable("reviews", {
	Date: text("Date").notNull(),
	Time: text("Time").notNull(),
	Com_Name: text("Com_Name").notNull(),
	File_Name: text("File_Name").notNull(),
	/** "confirmed" -- identification stood; "recategorized" -- it was changed. */
	action: text("action").notNull(),
	/** BirdNET's own score at review time. Never written back to `detections`. */
	confidence: real("confidence"),
	reviewed_at: text("reviewed_at").notNull(),
});

export type Review = typeof reviews.$inferSelect;
