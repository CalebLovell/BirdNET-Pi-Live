/**
 * The station's own vital signs, for the Settings masthead: is it about to run
 * out of room, how much it has stored, and when it last heard anything.
 *
 * Every metric is optional in practice -- a probe that cannot answer reports
 * `unknown` rather than failing, because a settings page that will not load
 * because it could not measure a disk is worse than one that admits it does
 * not know.
 */

export type HealthLevel = "ok" | "warn" | "problem" | "unknown";

export type HealthMetricId = "disk" | "database" | "last-detection";

export type HealthMetric = {
	id: HealthMetricId;
	label: string;
	value: string;
	/** The unit or qualifier set beside the figure, as on every other masthead. */
	detail?: string;
	level: HealthLevel;
	/** Why this reads the way it does, shown on hover. */
	hint?: string;
};

export type StationHealth = {
	metrics: HealthMetric[];
};

/**
 * Measured against the station's own purge threshold rather than a number we
 * invented: that setting is the point where BirdNET-Pi starts deleting
 * recordings or stops recording altogether, so it is the only figure that says
 * anything about *this* station. Amber gives ten points of warning before it.
 */
export function diskLevel(
	percentUsed: number,
	purgeThreshold: number,
): HealthLevel {
	if (percentUsed >= purgeThreshold) return "problem";
	return percentUsed >= purgeThreshold - 10 ? "warn" : "ok";
}

const HOUR = 60 * 60 * 1000;

/**
 * A station can legitimately hear nothing overnight, or through a quiet winter
 * day, so silence only becomes suspicious after a full day and only wrong
 * after three. `null` is a station that has never detected anything -- new,
 * not broken, so it reads as unknown rather than as a fault.
 */
export function lastDetectionLevel(ageMs: number | null): HealthLevel {
	if (ageMs === null) return "unknown";
	if (ageMs < 24 * HOUR) return "ok";
	return ageMs < 72 * HOUR ? "warn" : "problem";
}

const UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes < 0) return "—";
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < UNITS.length - 1) {
		value /= 1024;
		unit++;
	}
	// Bytes and kilobytes are never worth a decimal place here.
	return `${unit < 2 ? Math.round(value) : value.toFixed(2)} ${UNITS[unit]}`;
}

export function formatPercent(percent: number): string {
	return `${percent.toFixed(1)}%`;
}
