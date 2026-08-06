import "@tanstack/react-start/server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
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
	// Bounded rather than left to Node's `maxmem` to reject: a tampered file
	// naming a cost just under that limit would have us burn real CPU on a Pi
	// for every attempt. These are generous next to the values we write.
	if (cost.N > 1 << 20 || cost.r > 16 || cost.p > 4) return false;
	if (cost.N < 2 || cost.r < 1 || cost.p < 1) return false;

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
	// The password hash must never exist on disk world-readable, so the file is
	// created with restricted permissions rather than tightened afterwards.
	await writeFile(temporaryPath, serialize(next), {
		encoding: "utf8",
		mode: 0o600,
	});
	try {
		await rename(temporaryPath, authPath);
	} catch (error) {
		// A failed rename would otherwise leave the temp file behind on every
		// attempt. It is 0600 so nothing leaks, but they would accumulate in
		// /etc/birdnet forever.
		await rm(temporaryPath, { force: true });
		throw error;
	}
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
		try {
			await writeAuthFile(created, authPath);
		} catch (cause) {
			// An unwritable directory would otherwise throw a bare fs error out of
			// a function whose callers only know to expect AuthConfigError, and
			// would re-run scrypt on every single request while never succeeding.
			throw new AuthConfigError(
				`Cannot create ${authPath}: ${(cause as Error).message}`,
			);
		}
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

/**
 * Both password mutations live here rather than in `auth.server.ts` so the
 * command-line tool that sets the password can reach them without importing the
 * request and cookie helpers, which mean nothing outside a live HTTP request.
 *
 * Neither reads the existing file first. They replace it wholesale, and a
 * corrupt file is exactly when the owner most needs to be able to set a
 * password -- refusing to overwrite it would make the recovery tool useless in
 * the one situation it exists for.
 */
export async function changePassword(
	password: string,
	authPath = resolveAuthPath(),
) {
	if (password.length < MIN_PASSWORD_LENGTH) {
		throw new Error(
			`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
		);
	}
	await writeAuthFile(
		{ hash: hashPassword(password), isDefault: false, nonce: newNonce() },
		authPath,
	);
}

/** Restores the shipped default, which also re-imposes the local-network-only
 *  restriction on unlocking. */
export async function resetPasswordToDefault(authPath = resolveAuthPath()) {
	await writeAuthFile(
		{
			hash: hashPassword(DEFAULT_PASSWORD),
			isDefault: true,
			nonce: newNonce(),
		},
		authPath,
	);
}
