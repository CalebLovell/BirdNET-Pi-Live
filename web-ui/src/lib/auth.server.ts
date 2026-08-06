import "@tanstack/react-start/server-only";

import {
	deleteCookie,
	getCookie,
	getRequestIP,
	getRequestProtocol,
	setCookie,
} from "@tanstack/react-start/server";

import {
	type AuthFile,
	hashPassword,
	MIN_PASSWORD_LENGTH,
	newNonce,
	readAuthFile,
	resolveAuthPath,
	verifyPassword,
	writeAuthFile,
} from "./auth-file.server.ts";
import { defaultPasswordBlocksUnlock } from "./auth-policy.server.ts";
import {
	COOKIE_MAX_AGE_SECONDS,
	signSessionToken,
	UNLOCK_COOKIE_NAME,
	verifySessionToken,
} from "./auth-session.server.ts";
import { UnlockThrottle } from "./auth-throttle.server.ts";

export type UnlockStatus = { unlocked: boolean; isDefaultPassword: boolean };
export type UnlockResult =
	| { ok: true }
	| { ok: false; reason: "invalid" | "throttled" | "default-password-remote"; retryAfterMs?: number };

// Lazy so the throttle's state path is resolved on first use, not at module
// import time -- resolving eagerly at module scope would bake in whatever
// BIRDNET_AUTH_CONF happened to be set (or not) before tests or the
// password-setting CLI get a chance to set it.
let throttle: UnlockThrottle | undefined;
function getThrottle() {
	if (!throttle) {
		throttle = new UnlockThrottle({ statePath: `${resolveAuthPath()}.throttle.json` });
	}
	return throttle;
}

/**
 * Trusting `x-forwarded-for` unconditionally would let an attacker mint a fresh
 * address per attempt and walk straight through the throttle; ignoring it behind
 * a tunnel would collapse every client onto one address and let one attacker
 * lock the owner out. So it is honoured only when the deployment says so.
 */
export function resolveClientIp() {
	return getRequestIP({ xForwardedFor: Boolean(process.env.WEB_UI_TRUSTED_PROXY) });
}

function issueSession(auth: AuthFile) {
	setCookie(UNLOCK_COOKIE_NAME, signSessionToken(auth), {
		httpOnly: true,
		sameSite: "lax",
		path: "/",
		// Cannot be set over plain HTTP or the cookie is dropped outright, which
		// would break LAN use today. HTTPS is a deployment prerequisite before
		// exposing the station -- see the spec.
		secure: getRequestProtocol() === "https",
		maxAge: COOKIE_MAX_AGE_SECONDS,
	});
}

export async function readUnlockStatus(): Promise<UnlockStatus> {
	// A malformed auth file throws out of readAuthFile; callers convert that to
	// "locked", never to "open".
	const auth = await readAuthFile();
	const unlocked = verifySessionToken(auth, getCookie(UNLOCK_COOKIE_NAME));
	// Sliding renewal: every verified request pushes the expiry back out.
	if (unlocked) issueSession(auth);
	return { unlocked, isDefaultPassword: auth.isDefault };
}

export async function attemptUnlock(password: string): Promise<UnlockResult> {
	const auth = await readAuthFile();
	const ip = resolveClientIp();

	if (defaultPasswordBlocksUnlock(auth, ip)) {
		console.warn(`[auth] refused default-password unlock from ${ip ?? "unknown"}`);
		return { ok: false, reason: "default-password-remote" };
	}

	const gate = await getThrottle().check(ip ?? "unknown");
	if (!gate.allowed) {
		return { ok: false, reason: "throttled", retryAfterMs: gate.retryAfterMs };
	}

	if (!verifyPassword(password, auth.hash)) {
		await getThrottle().recordFailure(ip ?? "unknown");
		console.warn(`[auth] failed unlock from ${ip ?? "unknown"}`);
		return { ok: false, reason: "invalid" };
	}

	await getThrottle().recordSuccess(ip ?? "unknown");
	issueSession(auth);
	return { ok: true };
}

export function clearSession() {
	deleteCookie(UNLOCK_COOKIE_NAME, { path: "/" });
}

export async function rotateSessionNonce() {
	const auth = await readAuthFile();
	await writeAuthFile({ ...auth, nonce: newNonce() });
}

export async function changePassword(password: string) {
	if (password.length < MIN_PASSWORD_LENGTH) {
		throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
	}
	await readAuthFile();
	await writeAuthFile({ hash: hashPassword(password), isDefault: false, nonce: newNonce() });
}
