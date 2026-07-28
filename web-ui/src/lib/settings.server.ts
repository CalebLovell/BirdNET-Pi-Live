import "@tanstack/react-start/server-only";

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import {
	readReviewRareSpeciesMax,
	readSettingsPageValues,
	resolveSettingsPath,
	writeSettingsCard,
} from "./settings-config.server.ts";
import {
	parseSettingsCard,
	SUPPORTED_MODELS,
	type AudioSettings,
	type DetectionSettings,
	type PrivacySettings,
	type RecordingSettings,
	type ReviewSettings,
	type SettingsByKind,
	type SettingsCardKind,
	type SettingsPageData,
	type SettingsSaveResult,
	type StationSettings,
	type StorageSettings,
} from "./settings-data.ts";
import {
	runCardSystemActions,
	type SettingsCommandRunner,
} from "./settings-system.server.ts";

export { readReviewRareSpeciesMax };

export type SettingsServerDependencies = {
	settingsPath?: string;
	modelDirectory?: string;
	currentTimezone?: string;
	timezoneFileExists?: boolean;
	skipSystemActions?: boolean;
	runner?: SettingsCommandRunner;
};

async function currentTimezone() {
	try {
		const configured = (await readFile("/etc/timezone", "utf8")).trim();
		if (configured) return configured;
	} catch {
		// Non-Debian and development hosts fall back to the runtime timezone.
	}
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

async function installedModels(modelDirectory: string, configuredModel: string) {
	let names: string[] = [];
	try {
		names = await readdir(modelDirectory);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	const installed = new Set(
		names
			.filter((name) => name.endsWith(".tflite"))
			.map((name) => name.slice(0, -".tflite".length)),
	);
	return SUPPORTED_MODELS.filter(
		(model) => installed.has(model.id) || model.id === configuredModel,
	).map((model) => ({
		...model,
		label:
			installed.has(model.id) || model.id !== configuredModel
				? model.label
				: `${model.label} (configured file missing)`,
	}));
}

export async function loadSettingsPageData(
	dependencies: SettingsServerDependencies = {},
): Promise<SettingsPageData> {
	try {
		const timezone = dependencies.currentTimezone ?? (await currentTimezone());
		const settings = await readSettingsPageValues(
			dependencies.settingsPath ?? resolveSettingsPath(),
			timezone,
		);
		const modelDirectory =
			dependencies.modelDirectory ??
			process.env.BIRDNET_MODEL_DIR ??
			path.resolve(process.cwd(), "../model");
		return {
			...settings,
			supportedModels: await installedModels(
				modelDirectory,
				settings.detection.model,
			),
			supportedTimezones: Intl.supportedValuesOf("timeZone"),
		};
	} catch {
		throw new Error("BirdNET settings are unavailable.");
	}
}

async function saveSettings<K extends SettingsCardKind>(
	kind: K,
	input: SettingsByKind[K],
	dependencies: SettingsServerDependencies,
): Promise<SettingsSaveResult<SettingsByKind[K]>> {
	const values = parseSettingsCard(kind, input);
	let previousTimezone: string | undefined;
	if (kind === "station")
		previousTimezone =
			dependencies.currentTimezone ?? (await currentTimezone());
	try {
		await writeSettingsCard(
			kind,
			values,
			dependencies.settingsPath ?? resolveSettingsPath(),
		);
	} catch {
		throw new Error("Settings could not be saved.");
	}
	try {
		const action = await runCardSystemActions(
			kind,
			{
				previousTimezone,
				timezone:
					kind === "station"
						? (values as SettingsByKind["station"]).timezone
						: undefined,
				timezoneFileExists: dependencies.timezoneFileExists,
				skipSystemActions: dependencies.skipSystemActions,
			},
			dependencies.runner,
		);
		return action.skipped
			? {
					status: "saved-restart-skipped",
					values,
					message: "Saved. System actions were skipped in this environment.",
				}
			: {
					status: "saved",
					values,
					message: action.attempted
						? "Saved and applied."
						: "Saved.",
				};
	} catch {
		return {
			status: "saved-action-failed",
			values,
			message:
				"Saved, but the affected system services could not be updated.",
		};
	}
}

export function saveStationSettings(
	input: StationSettings,
	dependencies: SettingsServerDependencies = {},
) {
	return saveSettings("station", input, dependencies);
}

export function saveDetectionSettings(
	input: DetectionSettings,
	dependencies: SettingsServerDependencies = {},
) {
	return saveSettings("detection", input, dependencies);
}

export function savePrivacySettings(
	input: PrivacySettings,
	dependencies: SettingsServerDependencies = {},
) {
	return saveSettings("privacy", input, dependencies);
}

export function saveAudioSettings(
	input: AudioSettings,
	dependencies: SettingsServerDependencies = {},
) {
	return saveSettings("audio", input, dependencies);
}

export function saveRecordingSettings(
	input: RecordingSettings,
	dependencies: SettingsServerDependencies = {},
) {
	return saveSettings("recording", input, dependencies);
}

export function saveStorageSettings(
	input: StorageSettings,
	dependencies: SettingsServerDependencies = {},
) {
	return saveSettings("storage", input, dependencies);
}

export function saveReviewSettings(
	input: ReviewSettings,
	dependencies: SettingsServerDependencies = {},
) {
	return saveSettings("review", input, dependencies);
}
