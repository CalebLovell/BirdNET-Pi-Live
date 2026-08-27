/**
 * The station's own vital signs, for the Settings masthead: is it about to run
 * out of room, how much it has stored, and when it last heard anything.
 *
 * A probe that cannot answer reports its value as a plain string ("Unknown",
 * "None yet") rather than failing, because a settings page that will not load
 * because it could not measure a disk is worse than one that admits it does
 * not know.
 */

export type HealthMetricId = "disk" | "database" | "last-detection";

export type HealthMetric = {
	id: HealthMetricId;
	label: string;
	value: string;
};

export type StationHealth = {
	metrics: HealthMetric[];
};

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
