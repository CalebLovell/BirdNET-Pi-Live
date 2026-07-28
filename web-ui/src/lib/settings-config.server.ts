import "@tanstack/react-start/server-only";

import { randomUUID } from "node:crypto";
import { chmod, readFile, rename, rm, stat, writeFile } from "node:fs/promises";

import {
	DEFAULT_REVIEW_RARE_SPECIES_MAX,
	parseSettingsCard,
	type SettingsByKind,
	type SettingsCardKind,
} from "./settings-data.ts";

export function resolveSettingsPath() {
	return process.env.BIRDNET_CONF ?? "/etc/birdnet/birdnet.conf";
}

function decodeShellValue(value: string) {
	if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
		return value
			.slice(1, -1)
			.replace(/\\(["\\])/g, (_match, escaped: string) => escaped);
	}
	return value;
}

export function parseBirdnetConfig(text: string): Record<string, string> {
	const values: Record<string, string> = {};
	for (const line of text.split(/\r?\n/)) {
		const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
		if (match) values[match[1]] = decodeShellValue(match[2]);
	}
	return values;
}

function numberValue(
	values: Record<string, string>,
	key: string,
	fallback: number,
) {
	const parsed = Number(values[key]);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function integerValue(
	values: Record<string, string>,
	key: string,
	fallback: number,
) {
	const parsed = Number(values[key]);
	return Number.isSafeInteger(parsed) ? parsed : fallback;
}

export async function readSettingsPageValues(
	settingsPath = resolveSettingsPath(),
	timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): Promise<SettingsByKind> {
	const values = parseBirdnetConfig(await readFile(settingsPath, "utf8"));
	const streams = (values.RTSP_STREAM ?? "")
		.split(",")
		.map((stream) => stream.trim())
		.filter(Boolean);
	const extraction = values.EXTRACTION_LENGTH?.trim();
	return {
		station: parseSettingsCard("station", {
			siteName: values.SITE_NAME ?? "",
			latitude: numberValue(values, "LATITUDE", 0),
			longitude: numberValue(values, "LONGITUDE", 0),
			timezone,
		}),
		detection: parseSettingsCard("detection", {
			model: values.MODEL ?? "BirdNET_GLOBAL_6K_V2.4_Model_FP16",
			dataModelVersion: integerValue(values, "DATA_MODEL_VERSION", 1),
			speciesFrequencyThreshold: numberValue(values, "SF_THRESH", 0.03),
			confidence: numberValue(values, "CONFIDENCE", 0.7),
			sensitivity: numberValue(values, "SENSITIVITY", 1.25),
			overlap: numberValue(values, "OVERLAP", 0),
		}),
		privacy: parseSettingsCard("privacy", {
			privacyThreshold: numberValue(values, "PRIVACY_THRESHOLD", 0),
		}),
		audio: parseSettingsCard("audio", {
			mode: streams.length > 0 ? "rtsp" : "microphone",
			recordingDevice: values.REC_CARD ?? "default",
			channels: integerValue(values, "CHANNELS", 2),
			rtspStreams: streams,
			livestreamIndex: integerValue(
				values,
				"RTSP_STREAM_TO_LIVESTREAM",
				0,
			),
		}),
		recording: parseSettingsCard("recording", {
			recordingLength: integerValue(values, "RECORDING_LENGTH", 15),
			extractionLength: extraction
				? integerValue(values, "EXTRACTION_LENGTH", 6)
				: null,
			audioFormat: values.AUDIOFMT ?? "mp3",
		}),
		storage: parseSettingsCard("storage", {
			fullDiskAction: values.FULL_DISK ?? "purge",
			purgeThreshold: integerValue(values, "PURGE_THRESHOLD", 95),
			maxFilesPerSpecies: integerValue(values, "MAX_FILES_SPECIES", 0),
		}),
		review: parseSettingsCard("review", {
			rareSpeciesMax: integerValue(
				values,
				"REVIEW_RARE_SPECIES_MAX",
				DEFAULT_REVIEW_RARE_SPECIES_MAX,
			),
		}),
	};
}

function quoteShellValue(value: string) {
	return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function assignmentsFor<K extends SettingsCardKind>(
	kind: K,
	input: SettingsByKind[K],
): Record<string, string> {
	const value = parseSettingsCard(kind, input);
	switch (kind) {
		case "station": {
			const station = value as SettingsByKind["station"];
			return {
				SITE_NAME: quoteShellValue(station.siteName),
				LATITUDE: String(station.latitude),
				LONGITUDE: String(station.longitude),
			};
		}
		case "detection": {
			const detection = value as SettingsByKind["detection"];
			return {
				MODEL: detection.model,
				DATA_MODEL_VERSION: String(detection.dataModelVersion),
				SF_THRESH: String(detection.speciesFrequencyThreshold),
				CONFIDENCE: String(detection.confidence),
				SENSITIVITY: String(detection.sensitivity),
				OVERLAP: String(detection.overlap),
			};
		}
		case "privacy": {
			const privacy = value as SettingsByKind["privacy"];
			return { PRIVACY_THRESHOLD: String(privacy.privacyThreshold) };
		}
		case "audio": {
			const audio = value as SettingsByKind["audio"];
			return {
				REC_CARD: quoteShellValue(audio.recordingDevice),
				CHANNELS: String(audio.channels),
				RTSP_STREAM: quoteShellValue(
					audio.mode === "rtsp" ? audio.rtspStreams.join(",") : "",
				),
				RTSP_STREAM_TO_LIVESTREAM: String(
					audio.mode === "rtsp" ? audio.livestreamIndex : 0,
				),
			};
		}
		case "recording": {
			const recording = value as SettingsByKind["recording"];
			return {
				RECORDING_LENGTH: String(recording.recordingLength),
				EXTRACTION_LENGTH:
					recording.extractionLength === null
						? ""
						: String(recording.extractionLength),
				AUDIOFMT: recording.audioFormat,
			};
		}
		case "storage": {
			const storage = value as SettingsByKind["storage"];
			return {
				FULL_DISK: storage.fullDiskAction,
				PURGE_THRESHOLD: String(storage.purgeThreshold),
				MAX_FILES_SPECIES: String(storage.maxFilesPerSpecies),
			};
		}
		case "review": {
			const review = value as SettingsByKind["review"];
			return { REVIEW_RARE_SPECIES_MAX: String(review.rareSpeciesMax) };
		}
	}
}

function replaceAssignments(
	text: string,
	assignments: Record<string, string>,
	allowAppend: boolean,
) {
	let updated = text;
	for (const [key, value] of Object.entries(assignments)) {
		const expression = new RegExp(`^${key}=.*$`, "m");
		if (expression.test(updated)) updated = updated.replace(expression, `${key}=${value}`);
		else if (allowAppend && key === "REVIEW_RARE_SPECIES_MAX") {
			if (updated.length > 0 && !updated.endsWith("\n")) updated += "\n";
			updated += `${key}=${value}\n`;
		} else throw new Error(`Missing configuration assignment: ${key}`);
	}
	return updated;
}

export async function writeSettingsCard<K extends SettingsCardKind>(
	kind: K,
	values: SettingsByKind[K],
	settingsPath = resolveSettingsPath(),
) {
	const assignments = assignmentsFor(kind, values);
	const source = await readFile(settingsPath, "utf8");
	const sourceStat = await stat(settingsPath);
	const updated = replaceAssignments(source, assignments, kind === "review");
	const temporaryPath = `${settingsPath}.tmp-${process.pid}-${randomUUID()}`;
	try {
		await writeFile(temporaryPath, updated, {
			encoding: "utf8",
			mode: sourceStat.mode,
		});
		await chmod(temporaryPath, sourceStat.mode);
		await rename(temporaryPath, settingsPath);
	} finally {
		await rm(temporaryPath, { force: true });
	}
	return parseSettingsCard(kind, values);
}

export async function readReviewRareSpeciesMax(
	settingsPath = resolveSettingsPath(),
) {
	try {
		const values = parseBirdnetConfig(await readFile(settingsPath, "utf8"));
		const parsed = Number(values.REVIEW_RARE_SPECIES_MAX);
		return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 10_000
			? parsed
			: DEFAULT_REVIEW_RARE_SPECIES_MAX;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT")
			return DEFAULT_REVIEW_RARE_SPECIES_MAX;
		throw error;
	}
}
