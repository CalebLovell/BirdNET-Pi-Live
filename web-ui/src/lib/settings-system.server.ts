import "@tanstack/react-start/server-only";

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

import { RESETTABLE_CARDS, type SettingsCardKind } from "./settings-data.ts";

export type SettingsCommandRunner = (
	executable: string,
	args: readonly string[],
	stdin?: string,
) => Promise<void>;

export type SettingsSystemContext = {
	previousTimezone?: string;
	timezone?: string;
	timezoneFileExists?: boolean;
	skipSystemActions?: boolean;
};

const SERVICES = {
	station: ["birdnet_analysis.service"],
	detection: ["birdnet_analysis.service"],
	privacy: ["birdnet_analysis.service"],
	audio: [
		"birdnet_recording.service",
		"livestream.service",
		"spectrogram_viewer.service",
	],
	recording: [
		"birdnet_recording.service",
		"birdnet_analysis.service",
		"spectrogram_viewer.service",
	],
	storage: [],
	review: [],
} as const satisfies Record<SettingsCardKind, readonly string[]>;

const defaultRunner: SettingsCommandRunner = (executable, args, stdin) =>
	new Promise((resolve, reject) => {
		const child = spawn(executable, [...args], {
			shell: false,
			stdio: [stdin === undefined ? "ignore" : "pipe", "ignore", "ignore"],
			windowsHide: true,
		});
		child.once("error", reject);
		child.once("exit", (code) => {
			if (code === 0) resolve();
			else reject(new Error("System action failed"));
		});
		if (stdin !== undefined) child.stdin?.end(stdin);
	});

export async function runCardSystemActions(
	kind: SettingsCardKind,
	context: SettingsSystemContext = {},
	runner: SettingsCommandRunner = defaultRunner,
) {
	const timezoneChanges =
		kind === "station" &&
		context.timezone !== undefined &&
		context.timezone !== context.previousTimezone;
	const services = SERVICES[kind];
	const hasActions = timezoneChanges || services.length > 0;
	if (
		context.skipSystemActions ||
		process.env.BIRDNET_SKIP_SYSTEM_ACTIONS === "1"
	)
		return { attempted: false, skipped: hasActions };

	let attempted = false;
	if (timezoneChanges) {
		attempted = true;
		await runner("sudo", [
			"timedatectl",
			"set-timezone",
			context.timezone as string,
		]);
		if (context.timezoneFileExists ?? existsSync("/etc/timezone"))
			await runner(
				"sudo",
				["tee", "/etc/timezone"],
				`${context.timezone as string}\n`,
			);
	}
	if (services.length > 0) {
		attempted = true;
		await runner("sudo", ["systemctl", "restart", ...services]);
	}
	return { attempted, skipped: false };
}

/**
 * A reset rewrites every card at once, so the services they share are restarted
 * once between them -- card by card, birdnet_analysis would be bounced four
 * times over, and a station mid-analysis pays for each one.
 */
export async function runResetSystemActions(
	context: SettingsSystemContext = {},
	runner: SettingsCommandRunner = defaultRunner,
) {
	const services = [
		...new Set(RESETTABLE_CARDS.flatMap((kind) => SERVICES[kind])),
	];
	if (
		context.skipSystemActions ||
		process.env.BIRDNET_SKIP_SYSTEM_ACTIONS === "1"
	)
		return { attempted: false, skipped: services.length > 0 };
	if (services.length === 0) return { attempted: false, skipped: false };
	await runner("sudo", ["systemctl", "restart", ...services]);
	return { attempted: true, skipped: false };
}
