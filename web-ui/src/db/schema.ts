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
