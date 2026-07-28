import { createServerFn } from "@tanstack/react-start";
import {
	loadSettingsPageData,
	resetSettings,
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
