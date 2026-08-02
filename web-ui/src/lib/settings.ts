import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	loadSettingsPageData,
	resetSettings,
	restartStation,
	saveAudioSettings,
	saveDetectionSettings,
	savePrivacySettings,
	saveRecordingSettings,
	saveReviewSettings,
	saveStationSettings,
	saveStorageSettings,
} from "./settings.server.ts";
import {
	audioSettingsSchema,
	detectionSettingsSchema,
	privacySettingsSchema,
	recordingSettingsSchema,
	reviewSettingsSchema,
	stationSettingsSchema,
	storageSettingsSchema,
} from "./settings-data.ts";

export const getSettingsPage = createServerFn({ method: "GET" }).handler(() =>
	loadSettingsPageData(),
);

export const saveStationSettingsFn = createServerFn({ method: "POST" })
	.validator(stationSettingsSchema)
	.handler(({ data }) => saveStationSettings(data));

export const saveDetectionSettingsFn = createServerFn({ method: "POST" })
	.validator(detectionSettingsSchema)
	.handler(({ data }) => saveDetectionSettings(data));

export const savePrivacySettingsFn = createServerFn({ method: "POST" })
	.validator(privacySettingsSchema)
	.handler(({ data }) => savePrivacySettings(data));

export const saveAudioSettingsFn = createServerFn({ method: "POST" })
	.validator(audioSettingsSchema)
	.handler(({ data }) => saveAudioSettings(data));

export const saveRecordingSettingsFn = createServerFn({ method: "POST" })
	.validator(recordingSettingsSchema)
	.handler(({ data }) => saveRecordingSettings(data));

export const saveStorageSettingsFn = createServerFn({ method: "POST" })
	.validator(storageSettingsSchema)
	.handler(({ data }) => saveStorageSettings(data));

export const saveReviewSettingsFn = createServerFn({ method: "POST" })
	.validator(reviewSettingsSchema)
	.handler(({ data }) => saveReviewSettings(data));

export const resetSettingsFn = createServerFn({ method: "POST" }).handler(() =>
	resetSettings(),
);

/**
 * The card names the services to bounce, so a stale Detection card does not
 * take the recorder down with it. Validated against the known cards rather
 * than trusted: this ends in an argument list to `systemctl restart`.
 */
export const restartStationFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			card: z
				.enum([
					"station",
					"detection",
					"privacy",
					"audio",
					"recording",
					"storage",
					"review",
				])
				.optional(),
		}),
	)
	.handler(({ data }) => restartStation(data.card));
