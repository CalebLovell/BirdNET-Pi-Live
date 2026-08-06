import "@tanstack/react-start/server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseBirdnetConfig } from "~/lib/settings-config.server.ts";

/** Shipped so a fresh install is usable without touching the Pi. Kept
 *  harmless by the remote-unlock refusal in `auth-policy.server.ts`. */
export const DEFAULT_PASSWORD = "birdnet";

/** Only applies to passwords the owner chooses; the default is exempt. */
export const MIN_PASSWORD_LENGTH = 12;

const SCRYPT = { N: 16384, r: 8, p: 1 } as const;
const KEY_LENGTH = 32;

export type AuthFile = { hash: string; isDefault: boolean; nonce: string };

/** Thrown when the file exists but cannot be trusted. Callers must treat this
 *  as "locked", never as "no password configured". */
export class AuthConfigError extends Error {}

export function resolveAuthPath() {
	return process.env.BIRDNET_AUTH_CONF ?? "/etc/birdnet/web-ui-auth.conf";
}

export function hashPassword(password: string, salt = randomBytes(16)) {
	const derived = scryptSync(password, salt, KEY_LENGTH, SCRYPT);
	return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string) {
	const parts = stored.split("$");
	if (parts.length !== 6 || parts[0] !== "scrypt") return false;

	const [, n, r, p, saltB64, expectedB64] = parts;
	const cost = { N: Number(n), r: Number(r), p: Number(p) };
	if (!Object.values(cost).every(Number.isSafeInteger)) return false;

	const expected = Buffer.from(expectedB64, "base64");
	if (expected.length !== KEY_LENGTH) return false;

	// scrypt throws on absurd parameters from a tampered file -- a bad file is
	// a failed login, not a 500.
	try {
		const actual = scryptSync(
			password,
			Buffer.from(saltB64, "base64"),
			KEY_LENGTH,
			cost,
		);
		return timingSafeEqual(actual, expected);
	} catch {
		return false;
	}
}

function serialize(auth: AuthFile) {
	return [
		"# BirdNET-Pi web UI password. Do not edit by hand --",
		"# use scripts/set_web_ui_password.sh.",
		`WEB_UI_PWD_HASH=${auth.hash}`,
		`WEB_UI_PWD_IS_DEFAULT=${auth.isDefault ? "1" : "0"}`,
		`WEB_UI_SESSION_NONCE=${auth.nonce}`,
		"",
	].join("\n");
}

/** Same temp-file-then-rename dance as `writeSettingsCard`, so a crash mid-write
 *  can never leave a half-written file that locks the owner out. */
export async function writeAuthFile(
	next: AuthFile,
	authPath = resolveAuthPath(),
) {
	const temporaryPath = path.join(
		path.dirname(authPath),
		`.${path.basename(authPath)}.${process.pid}.tmp`,
	);
	await writeFile(temporaryPath, serialize(next), "utf8");
	await chmod(temporaryPath, 0o600);
	await rename(temporaryPath, authPath);
}

export function newNonce() {
	return randomBytes(16).toString("hex");
}

export async function readAuthFile(
	authPath = resolveAuthPath(),
): Promise<AuthFile> {
	let text: string;
	try {
		text = await readFile(authPath, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			throw new AuthConfigError(
				`Cannot read ${authPath}: ${(error as Error).message}`,
			);
		}
		const created: AuthFile = {
			hash: hashPassword(DEFAULT_PASSWORD),
			isDefault: true,
			nonce: newNonce(),
		};
		await writeAuthFile(created, authPath);
		return created;
	}

	const values = parseBirdnetConfig(text);
	const hash = values.WEB_UI_PWD_HASH ?? "";
	const nonce = values.WEB_UI_SESSION_NONCE ?? "";
	// A hash that verifies nothing would lock the owner out silently; a missing
	// nonce would make every cookie signature meaningless. Both are corruption.
	if (
		!/^scrypt\$\d+\$\d+\$\d+\$[^$]+\$[^$]+$/.test(hash) ||
		!/^[0-9a-f]{32}$/.test(nonce)
	) {
		throw new AuthConfigError(
			`${authPath} is malformed; the web UI stays locked.`,
		);
	}

	return { hash, isDefault: values.WEB_UI_PWD_IS_DEFAULT === "1", nonce };
}
