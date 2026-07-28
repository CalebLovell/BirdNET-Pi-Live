import {
	Disc3,
	HardDrive,
	ListChecks,
	MapPin,
	Mic2,
	ShieldCheck,
	SlidersHorizontal,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Input } from "~/components/ui/input.tsx";
import type {
	AudioSettings,
	DetectionSettings,
	PrivacySettings,
	RecordingSettings,
	ReviewSettings,
	SettingsPageData,
	SettingsSaveResult,
	StationSettings,
	StorageSettings,
} from "~/lib/settings-data.ts";
import { type CardSaveState, SettingsCard } from "./settings-card.tsx";

type Saver<T> = (values: T) => Promise<SettingsSaveResult<T>>;

export type SettingsSavers = {
	station?: Saver<StationSettings>;
	detection?: Saver<DetectionSettings>;
	privacy?: Saver<PrivacySettings>;
	audio?: Saver<AudioSettings>;
	recording?: Saver<RecordingSettings>;
	storage?: Saver<StorageSettings>;
	review?: Saver<ReviewSettings>;
};

function useCardSave<T>(initial: T, save?: Saver<T>) {
	const [values, setValues] = useState(initial);
	const [state, setState] = useState<CardSaveState>("idle");
	const [message, setMessage] = useState<string>();
	async function submit() {
		if (!save) return;
		setState("saving");
		setMessage("Saving this section…");
		try {
			const result = await save(values);
			setValues(result.values);
			setState(result.status === "saved-action-failed" ? "warning" : "saved");
			setMessage(result.message);
		} catch (error) {
			setState("error");
			setMessage(
				error instanceof Error
					? error.message
					: "These settings could not be saved.",
			);
		}
	}
	return { values, setValues, state, message, submit };
}

const controlClass =
	"h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:border-[var(--hover-line)]";

function Field({
	label,
	hint,
	children,
}: {
	label: string;
	hint?: string;
	children: ReactNode;
}) {
	return (
		// The control is nested, so the label association is native HTML even
		// though Biome cannot see through this component's ReactNode boundary.
		// biome-ignore lint/a11y/noLabelWithoutControl: nested labeled control
		<label className="block space-y-1.5">
			<span className="font-medium text-sm">{label}</span>
			{children}
			{hint ? (
				<span className="block text-muted-foreground text-xs leading-relaxed">
					{hint}
				</span>
			) : null}
		</label>
	);
}

function twoColumns(children: ReactNode) {
	return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

export function SettingsCards({
	data,
	savers,
}: {
	data: SettingsPageData;
	savers: SettingsSavers;
}) {
	return (
		<div className="grid items-start gap-4 lg:grid-cols-2">
			<StationCard
				initial={data.station}
				timezones={data.supportedTimezones}
				save={savers.station}
			/>
			<DetectionCard
				initial={data.detection}
				models={data.supportedModels}
				save={savers.detection}
			/>
			<PrivacyCard initial={data.privacy} save={savers.privacy} />
			<AudioCard initial={data.audio} save={savers.audio} />
			<RecordingCard initial={data.recording} save={savers.recording} />
			<StorageCard initial={data.storage} save={savers.storage} />
			<ReviewCard initial={data.review} save={savers.review} />
		</div>
	);
}

function StationCard({
	initial,
	timezones,
	save,
}: {
	initial: StationSettings;
	timezones: string[];
	save?: Saver<StationSettings>;
}) {
	const form = useCardSave(initial, save);
	return (
		<SettingsCard
			title="Station"
			description="Name the station and locate it for geographic species filtering."
			icon={MapPin}
			state={form.state}
			message={form.message}
			onSubmit={(event) => {
				event.preventDefault();
				void form.submit();
			}}
		>
			<Field label="Station name">
				<Input
					value={form.values.siteName}
					maxLength={80}
					onChange={(event) =>
						form.setValues({ ...form.values, siteName: event.target.value })
					}
				/>
			</Field>
			{twoColumns(
				<>
					<Field label="Latitude">
						<Input
							type="number"
							min={-90}
							max={90}
							step="any"
							required
							value={form.values.latitude}
							onChange={(event) =>
								form.setValues({
									...form.values,
									latitude: event.target.valueAsNumber,
								})
							}
						/>
					</Field>
					<Field label="Longitude">
						<Input
							type="number"
							min={-180}
							max={180}
							step="any"
							required
							value={form.values.longitude}
							onChange={(event) =>
								form.setValues({
									...form.values,
									longitude: event.target.valueAsNumber,
								})
							}
						/>
					</Field>
				</>,
			)}
			<Field
				label="Timezone"
				hint="Changing this updates the station's operating-system timezone."
			>
				<select
					className={controlClass}
					value={form.values.timezone}
					onChange={(event) =>
						form.setValues({ ...form.values, timezone: event.target.value })
					}
				>
					{timezones.map((timezone) => (
						<option key={timezone}>{timezone}</option>
					))}
				</select>
			</Field>
		</SettingsCard>
	);
}

function DetectionCard({
	initial,
	models,
	save,
}: {
	initial: DetectionSettings;
	models: SettingsPageData["supportedModels"];
	save?: Saver<DetectionSettings>;
}) {
	const form = useCardSave(initial, save);
	const selectedModel = models.find((model) => model.id === form.values.model);
	return (
		<SettingsCard
			title="Detection"
			description="Tune which model predictions become saved detections."
			icon={SlidersHorizontal}
			state={form.state}
			message={form.message}
			onSubmit={(event) => {
				event.preventDefault();
				void form.submit();
			}}
		>
			<Field label="Analysis model">
				<select
					className={controlClass}
					value={form.values.model}
					onChange={(event) =>
						form.setValues({
							...form.values,
							model: event.target.value as DetectionSettings["model"],
						})
					}
				>
					{models.map((model) => (
						<option key={model.id} value={model.id}>
							{model.label}
						</option>
					))}
				</select>
			</Field>
			{twoColumns(
				<>
					<Field
						label="Minimum confidence"
						hint="Higher values save fewer, more confident predictions."
					>
						<Input
							type="number"
							min={0.01}
							max={0.99}
							step={0.01}
							required
							value={form.values.confidence}
							onChange={(event) =>
								form.setValues({
									...form.values,
									confidence: event.target.valueAsNumber,
								})
							}
						/>
					</Field>
					<Field
						label="Sensitivity"
						hint="Changes how readily the model scores a sound as a bird."
					>
						<Input
							type="number"
							min={0.5}
							max={1.5}
							step={0.05}
							required
							value={form.values.sensitivity}
							onChange={(event) =>
								form.setValues({
									...form.values,
									sensitivity: event.target.valueAsNumber,
								})
							}
						/>
					</Field>
					<Field
						label="Analysis overlap"
						hint="More overlap improves coverage but uses more compute."
					>
						<Input
							type="number"
							min={0}
							max={2.9}
							step={0.1}
							required
							value={form.values.overlap}
							onChange={(event) =>
								form.setValues({
									...form.values,
									overlap: event.target.valueAsNumber,
								})
							}
						/>
					</Field>
				</>,
			)}
			{selectedModel?.supportsRangeModel
				? twoColumns(
						<>
							<Field label="Location model version">
								<select
									className={controlClass}
									value={form.values.dataModelVersion}
									onChange={(event) =>
										form.setValues({
											...form.values,
											dataModelVersion: Number(event.target.value) as 1 | 2,
										})
									}
								>
									<option value={1}>Version 1</option>
									<option value={2}>Version 2</option>
								</select>
							</Field>
							<Field
								label="Species-frequency threshold"
								hint="Narrows candidates using location and season."
							>
								<Input
									type="number"
									min={0.0005}
									max={0.99}
									step={0.0005}
									required
									value={form.values.speciesFrequencyThreshold}
									onChange={(event) =>
										form.setValues({
											...form.values,
											speciesFrequencyThreshold: event.target.valueAsNumber,
										})
									}
								/>
							</Field>
						</>,
					)
				: null}
		</SettingsCard>
	);
}

function PrivacyCard({
	initial,
	save,
}: {
	initial: PrivacySettings;
	save?: Saver<PrivacySettings>;
}) {
	const form = useCardSave(initial, save);
	return (
		<SettingsCard
			title="Privacy"
			description="Suppress chunks where the model detects likely human sounds."
			icon={ShieldCheck}
			state={form.state}
			message={form.message}
			onSubmit={(event) => {
				event.preventDefault();
				void form.submit();
			}}
		>
			<Field
				label="Privacy threshold"
				hint="0 disables suppression. Larger values inspect a broader portion of predictions."
			>
				<Input
					type="number"
					min={0}
					max={3}
					step={0.1}
					required
					value={form.values.privacyThreshold}
					onChange={(event) =>
						form.setValues({ privacyThreshold: event.target.valueAsNumber })
					}
				/>
			</Field>
			<p className="rounded-md bg-muted p-3 text-muted-foreground text-xs leading-relaxed">
				Matching chunks and their neighbors are suppressed. This reduces
				incidental speech capture, but it cannot guarantee that speech is never
				recorded.
			</p>
		</SettingsCard>
	);
}

function AudioCard({
	initial,
	save,
}: {
	initial: AudioSettings;
	save?: Saver<AudioSettings>;
}) {
	const form = useCardSave(initial, save);
	return (
		<SettingsCard
			title="Audio input"
			description="Choose a local microphone or one or more network audio streams."
			icon={Mic2}
			state={form.state}
			message={form.message}
			onSubmit={(event) => {
				event.preventDefault();
				void form.submit();
			}}
		>
			<Field label="Input mode">
				<select
					className={controlClass}
					value={form.values.mode}
					onChange={(event) =>
						form.setValues({
							...form.values,
							mode: event.target.value as AudioSettings["mode"],
						})
					}
				>
					<option value="microphone">Microphone</option>
					<option value="rtsp">RTSP network stream</option>
				</select>
			</Field>
			{form.values.mode === "microphone" ? (
				twoColumns(
					<>
						<Field
							label="Recording device"
							hint="ALSA or PulseAudio device identifier."
						>
							<Input
								required
								value={form.values.recordingDevice}
								placeholder="default"
								onChange={(event) =>
									form.setValues({
										...form.values,
										recordingDevice: event.target.value,
									})
								}
							/>
						</Field>
						<Field label="Channels">
							<Input
								type="number"
								min={1}
								max={32}
								required
								value={form.values.channels}
								onChange={(event) =>
									form.setValues({
										...form.values,
										channels: event.target.valueAsNumber,
									})
								}
							/>
						</Field>
					</>,
				)
			) : (
				<>
					<Field
						label="RTSP streams"
						hint="One rtsp:// or rtsps:// URL per line. Credentials remain in the station configuration."
					>
						<textarea
							className={`${controlClass} min-h-28 py-2 font-mono text-xs`}
							required
							value={form.values.rtspStreams.join("\n")}
							onChange={(event) =>
								form.setValues({
									...form.values,
									rtspStreams: event.target.value.split(/\r?\n/),
								})
							}
						/>
					</Field>
					{form.values.rtspStreams.filter(Boolean).length > 1 ? (
						<Field label="Live-player stream">
							<select
								className={controlClass}
								value={form.values.livestreamIndex}
								onChange={(event) =>
									form.setValues({
										...form.values,
										livestreamIndex: Number(event.target.value),
									})
								}
							>
								{form.values.rtspStreams
									.filter(Boolean)
									.map((stream, index) => (
										<option key={stream} value={index}>
											Stream {index + 1}
										</option>
									))}
							</select>
						</Field>
					) : null}
				</>
			)}
		</SettingsCard>
	);
}

function RecordingCard({
	initial,
	save,
}: {
	initial: RecordingSettings;
	save?: Saver<RecordingSettings>;
}) {
	const form = useCardSave(initial, save);
	return (
		<SettingsCard
			title="Recording"
			description="Control capture duration and the files retained for playback."
			icon={Disc3}
			state={form.state}
			message={form.message}
			onSubmit={(event) => {
				event.preventDefault();
				void form.submit();
			}}
		>
			{twoColumns(
				<>
					<Field
						label="Recording length"
						hint="Seconds per analyzed recording."
					>
						<Input
							type="number"
							min={3}
							max={60}
							required
							value={form.values.recordingLength}
							onChange={(event) =>
								form.setValues({
									...form.values,
									recordingLength: event.target.valueAsNumber,
								})
							}
						/>
					</Field>
					<Field
						label="Extraction length"
						hint="Leave blank to use the backend default."
					>
						<Input
							type="number"
							min={3}
							max={form.values.recordingLength}
							value={form.values.extractionLength ?? ""}
							onChange={(event) =>
								form.setValues({
									...form.values,
									extractionLength:
										event.target.value === ""
											? null
											: event.target.valueAsNumber,
								})
							}
						/>
					</Field>
				</>,
			)}
			<Field label="Audio format">
				<select
					className={controlClass}
					value={form.values.audioFormat}
					onChange={(event) =>
						form.setValues({
							...form.values,
							audioFormat: event.target
								.value as RecordingSettings["audioFormat"],
						})
					}
				>
					<option value="mp3">MP3</option>
					<option value="wav">WAV</option>
					<option value="flac">FLAC</option>
					<option value="ogg">Ogg Vorbis</option>
				</select>
			</Field>
		</SettingsCard>
	);
}

function StorageCard({
	initial,
	save,
}: {
	initial: StorageSettings;
	save?: Saver<StorageSettings>;
}) {
	const form = useCardSave(initial, save);
	return (
		<SettingsCard
			title="Storage"
			description="Decide what happens as the station fills its disk."
			icon={HardDrive}
			state={form.state}
			message={form.message}
			onSubmit={(event) => {
				event.preventDefault();
				void form.submit();
			}}
		>
			<fieldset className="space-y-2">
				<legend className="mb-1.5 font-medium text-sm">Disk-full action</legend>
				<label className="flex cursor-pointer gap-3 rounded-md border p-3">
					<input
						type="radio"
						name="full-disk-action"
						value="purge"
						checked={form.values.fullDiskAction === "purge"}
						onChange={() =>
							form.setValues({ ...form.values, fullDiskAction: "purge" })
						}
					/>
					<span>
						<strong className="block text-sm">Purge old data</strong>
						<span className="text-muted-foreground text-xs">
							When the threshold is crossed, removes the oldest recordings and
							detection rows.
						</span>
					</span>
				</label>
				<label className="flex cursor-pointer gap-3 rounded-md border p-3">
					<input
						type="radio"
						name="full-disk-action"
						value="keep"
						checked={form.values.fullDiskAction === "keep"}
						onChange={() =>
							form.setValues({ ...form.values, fullDiskAction: "keep" })
						}
					/>
					<span>
						<strong className="block text-sm">Keep all data</strong>
						<span className="text-muted-foreground text-xs">
							Stops core services when space runs out instead of deleting
							recordings.
						</span>
					</span>
				</label>
			</fieldset>
			{twoColumns(
				<>
					<Field
						label="Disk-used threshold"
						hint="Percent used before the selected action runs."
					>
						<Input
							type="number"
							min={20}
							max={99}
							required
							value={form.values.purgeThreshold}
							onChange={(event) =>
								form.setValues({
									...form.values,
									purgeThreshold: event.target.valueAsNumber,
								})
							}
						/>
					</Field>
					<Field
						label="Maximum files per species"
						hint="0 keeps every recording, subject to disk-full handling."
					>
						<Input
							type="number"
							min={0}
							required
							value={form.values.maxFilesPerSpecies}
							onChange={(event) =>
								form.setValues({
									...form.values,
									maxFilesPerSpecies: event.target.valueAsNumber,
								})
							}
						/>
					</Field>
				</>,
			)}
		</SettingsCard>
	);
}

function ReviewCard({
	initial,
	save,
}: {
	initial: ReviewSettings;
	save?: Saver<ReviewSettings>;
}) {
	const form = useCardSave(initial, save);
	return (
		<SettingsCard
			title="Review queue"
			description="Define which uncommon species appear for manual confirmation."
			icon={ListChecks}
			state={form.state}
			message={form.message}
			onSubmit={(event) => {
				event.preventDefault();
				void form.submit();
			}}
		>
			<Field
				label="Rare species threshold"
				hint="Review includes species with strictly fewer lifetime detections than this number."
			>
				<Input
					type="number"
					min={1}
					max={10000}
					required
					value={form.values.rareSpeciesMax}
					onChange={(event) =>
						form.setValues({ rareSpeciesMax: event.target.valueAsNumber })
					}
				/>
			</Field>
			<p className="rounded-md bg-muted p-3 text-muted-foreground text-xs leading-relaxed">
				For example, a threshold of 10 includes species heard 9 times or fewer.
				The Review page reads this value on every load.
			</p>
		</SettingsCard>
	);
}
