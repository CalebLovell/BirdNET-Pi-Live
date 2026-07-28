import { z } from "zod";

export const DEFAULT_REVIEW_RARE_SPECIES_MAX = 10;

const MODEL_IDS = [
	"BirdNET_GLOBAL_6K_V2.4_Model_FP16",
	"BirdNET_6K_GLOBAL_MODEL",
	"Perch_v2",
	"BirdNET-Go_classifier_20250916",
] as const;

export type SupportedModel = {
	id: (typeof MODEL_IDS)[number];
	label: string;
	supportsRangeModel: boolean;
};

export const SUPPORTED_MODELS: readonly SupportedModel[] = [
	{
		id: "BirdNET_GLOBAL_6K_V2.4_Model_FP16",
		label: "BirdNET Global 6K v2.4",
		supportsRangeModel: true,
	},
	{
		id: "BirdNET_6K_GLOBAL_MODEL",
		label: "BirdNET Global 6K (legacy)",
		supportsRangeModel: false,
	},
	{
		id: "Perch_v2",
		label: "Perch v2",
		supportsRangeModel: false,
	},
	{
		id: "BirdNET-Go_classifier_20250916",
		label: "BirdNET-Go 2025 classifier",
		supportsRangeModel: true,
	},
];

const noControlCharacters = /^[^\u0000-\u001f\u007f]*$/;
const safeText = (maximum: number) =>
	z
		.string()
		.trim()
		.max(maximum)
		.regex(noControlCharacters, "Control characters are not allowed");

const supportedTimezones = new Set(Intl.supportedValuesOf("timeZone"));

export const stationSettingsSchema = z.object({
	siteName: safeText(80),
	latitude: z.number().finite().min(-90).max(90),
	longitude: z.number().finite().min(-180).max(180),
	timezone: z
		.string()
		.refine((value) => supportedTimezones.has(value), "Unsupported timezone"),
});

export const detectionSettingsSchema = z.object({
	model: z.enum(MODEL_IDS),
	dataModelVersion: z.union([z.literal(1), z.literal(2)]),
	speciesFrequencyThreshold: z.number().finite().min(0.0005).max(0.99),
	confidence: z.number().finite().min(0.01).max(0.99),
	sensitivity: z.number().finite().min(0.5).max(1.5),
	overlap: z.number().finite().min(0).max(2.9),
});

export const privacySettingsSchema = z.object({
	privacyThreshold: z.number().finite().min(0).max(3),
});

const rtspStreamSchema = z
	.string()
	.trim()
	.url()
	.refine((value) => {
		const protocol = new URL(value).protocol;
		return protocol === "rtsp:" || protocol === "rtsps:";
	}, "Use an rtsp:// or rtsps:// URL");

const rtspStreamsSchema = z.preprocess((value) => {
	if (typeof value !== "string") return value;
	return value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
}, z.array(rtspStreamSchema));

export const audioSettingsSchema = z
	.object({
		mode: z.enum(["microphone", "rtsp"]),
		recordingDevice: safeText(200),
		channels: z.number().int().min(1).max(32),
		rtspStreams: rtspStreamsSchema,
		livestreamIndex: z.number().int().min(0),
	})
	.superRefine((value, context) => {
		if (value.mode === "microphone" && value.recordingDevice.length === 0) {
			context.addIssue({
				code: "custom",
				path: ["recordingDevice"],
				message: "A recording device is required in microphone mode",
			});
		}
		if (value.mode === "rtsp" && value.rtspStreams.length === 0) {
			context.addIssue({
				code: "custom",
				path: ["rtspStreams"],
				message: "Add at least one RTSP stream",
			});
		}
		if (
			value.mode === "rtsp" &&
			value.livestreamIndex >= value.rtspStreams.length
		) {
			context.addIssue({
				code: "custom",
				path: ["livestreamIndex"],
				message: "Select a configured live stream",
			});
		}
	});

export const recordingSettingsSchema = z
	.object({
		recordingLength: z.number().int().min(3).max(60),
		extractionLength: z.number().int().min(3).max(60).nullable(),
		audioFormat: z.enum(["mp3", "wav", "flac", "ogg"]),
	})
	.superRefine((value, context) => {
		if (
			value.extractionLength !== null &&
			value.extractionLength > value.recordingLength
		) {
			context.addIssue({
				code: "custom",
				path: ["extractionLength"],
				message: "Extraction length cannot exceed recording length",
			});
		}
	});

export const storageSettingsSchema = z.object({
	fullDiskAction: z.enum(["purge", "keep"]),
	purgeThreshold: z.number().int().min(20).max(99),
	maxFilesPerSpecies: z.number().int().min(0),
});

export const reviewSettingsSchema = z.object({
	rareSpeciesMax: z
		.number()
		.int()
		.min(1)
		.max(10_000)
		.default(DEFAULT_REVIEW_RARE_SPECIES_MAX),
});

export type StationSettings = z.infer<typeof stationSettingsSchema>;
export type DetectionSettings = z.infer<typeof detectionSettingsSchema>;
export type PrivacySettings = z.infer<typeof privacySettingsSchema>;
export type AudioSettings = z.infer<typeof audioSettingsSchema>;
export type RecordingSettings = z.infer<typeof recordingSettingsSchema>;
export type StorageSettings = z.infer<typeof storageSettingsSchema>;
export type ReviewSettings = z.infer<typeof reviewSettingsSchema>;

export type SettingsCardKind =
	| "station"
	| "detection"
	| "privacy"
	| "audio"
	| "recording"
	| "storage"
	| "review";

export type SettingsByKind = {
	station: StationSettings;
	detection: DetectionSettings;
	privacy: PrivacySettings;
	audio: AudioSettings;
	recording: RecordingSettings;
	storage: StorageSettings;
	review: ReviewSettings;
};

export type SettingsPageData = SettingsByKind & {
	supportedModels: SupportedModel[];
	supportedTimezones: string[];
};

export type SettingsSaveResult<T> = {
	status: "saved" | "saved-restart-skipped" | "saved-action-failed";
	values: T;
	message: string;
};

const schemas = {
	station: stationSettingsSchema,
	detection: detectionSettingsSchema,
	privacy: privacySettingsSchema,
	audio: audioSettingsSchema,
	recording: recordingSettingsSchema,
	storage: storageSettingsSchema,
	review: reviewSettingsSchema,
} as const;

export function parseSettingsCard<K extends SettingsCardKind>(
	kind: K,
	input: unknown,
): SettingsByKind[K] {
	return schemas[kind].parse(input) as SettingsByKind[K];
}
