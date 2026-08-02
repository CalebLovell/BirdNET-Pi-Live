import "@tanstack/react-start/server-only";

import { stat, statfs } from "node:fs/promises";

import { detectionsDbPath, sqlite } from "~/db/index.ts";
import { extractedDir } from "~/lib/audio.server.ts";
import {
	diskLevel,
	formatBytes,
	formatPercent,
	type HealthMetric,
	lastDetectionLevel,
	type StationHealth,
} from "~/lib/health-data.ts";
import { readSettingsPageValues } from "~/lib/settings-config.server.ts";
import { formatTimeAgo } from "~/lib/time-ago.ts";

/**
 * The filesystem holding the recordings, which is the one the purge threshold
 * is about -- not necessarily the one the app is installed on.
 */
async function diskMetric(purgeThreshold: number): Promise<HealthMetric> {
	const base = { id: "disk", label: "Disk" } as const;
	try {
		const stats = await statfs(extractedDir());
		const total = stats.blocks * stats.bsize;
		// `bavail` excludes the root-reserved blocks, so this is the space that
		// actually remains for recordings rather than the theoretical figure.
		const free = stats.bavail * stats.bsize;
		if (!(total > 0)) return { ...base, value: "—", level: "unknown" };
		const percentUsed = ((total - free) / total) * 100;
		return {
			...base,
			value: formatPercent(percentUsed),
			detail: "used",
			level: diskLevel(percentUsed, purgeThreshold),
			hint: `${formatBytes(free)} free of ${formatBytes(total)} — this station acts at ${purgeThreshold}%`,
		};
	} catch {
		return {
			...base,
			value: "Unknown",
			level: "unknown",
			hint: "The recordings directory could not be read",
		};
	}
}

async function databaseMetric(): Promise<HealthMetric> {
	const base = { id: "database", label: "Database" } as const;
	try {
		const { size } = await stat(detectionsDbPath());
		// Always neutral: there is no size at which a detections database is
		// unhealthy, so colouring it would be inventing a threshold.
		return {
			...base,
			value: formatBytes(size),
			level: "ok",
			hint: "Size of the BirdNET-Pi detections database",
		};
	} catch {
		return {
			...base,
			value: "Unknown",
			level: "unknown",
			hint: "The detections database could not be read",
		};
	}
}

function lastDetectionMetric(now: number): HealthMetric {
	const base = { id: "last-detection", label: "Last detection" } as const;
	try {
		const row = sqlite
			.prepare(
				"SELECT Date date, Time time FROM detections ORDER BY Date DESC, Time DESC LIMIT 1",
			)
			.get() as { date: string; time: string } | undefined;
		if (!row)
			return {
				...base,
				value: "None yet",
				level: "unknown",
				hint: "This station has not recorded a detection",
			};
		const recorded = new Date(`${row.date}T${row.time}`);
		if (Number.isNaN(recorded.getTime()))
			return { ...base, value: "Unknown", level: "unknown" };
		const ageMs = now - recorded.getTime();
		return {
			...base,
			value: formatTimeAgo(ageMs),
			level: lastDetectionLevel(ageMs),
			hint: `Recorded ${row.date} at ${row.time}`,
		};
	} catch {
		return { ...base, value: "Unknown", level: "unknown" };
	}
}

/**
 * Never throws. The masthead it feeds sits above six working settings cards,
 * and a health probe is not worth taking those down for -- every metric that
 * cannot be measured says so in its own tile instead.
 */
export async function loadStationHealth(): Promise<StationHealth> {
	let purgeThreshold = 95;
	try {
		purgeThreshold = (await readSettingsPageValues()).storage.purgeThreshold;
	} catch {
		// No readable config: fall back to BirdNET-Pi's own default so the disk
		// tile still has something meaningful to compare against.
	}
	const metrics = await Promise.all([
		diskMetric(purgeThreshold),
		databaseMetric(),
		Promise.resolve(lastDetectionMetric(Date.now())),
	]);
	return { metrics };
}
