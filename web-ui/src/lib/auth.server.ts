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
	| {
			ok: false;
			reason: "invalid" | "throttled" | "default-password-remote";
			retryAfterMs?: number;
	  };

// Lazy so the throttle's state path is resolved on first use, not at module
// import time -- resolving eagerly at module scope would bake in whatever
// BIRDNET_AUTH_CONF happened to be set (or not) before tests or the
// password-setting CLI get a chance to set it.
let throttle: UnlockThrottle | undefined;
function getThrottle() {
	if (!throttle) {
		throttle = new UnlockThrottle({
			statePath: `${resolveAuthPath()}.throttle.json`,
		});
	}
	return throttle;
}

/**
 * Trusting `x-forwarded-for` unconditionally would let an attacker mint a fresh
 * address per attempt and walk straight through the throttle; ignoring it behind
 * a tunnel would collapse every client onto one address and let one attacker
 * lock the owner out. So it is honoured only when the deployment says so.
 */
function resolveClientIp() {
	return getRequestIP({
		xForwardedFor: Boolean(process.env.WEB_UI_TRUSTED_PROXY),
	});
}

/**
 * Every caller whose address cannot be determined shares this one throttle
 * bucket, and it is deliberately not a private address, so those callers are
 * also subject to the global ceiling. That is the safe direction -- an
 * unidentifiable client is treated as remote -- but it does mean that on a
 * deployment where the address is never available, one attacker's failures
 * throttle everyone. Setting `WEB_UI_TRUSTED_PROXY` correctly is what avoids
 * that.
 */
const UNKNOWN_CLIENT = "unknown";

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
	const client = ip ?? UNKNOWN_CLIENT;
	const throttle = getThrottle();

	if (defaultPasswordBlocksUnlock(auth, ip)) {
		console.warn(`[auth] refused default-password unlock from ${client}`);
		return { ok: false, reason: "default-password-remote" };
	}

	const gate = await throttle.check(client);
	if (!gate.allowed) {
		return { ok: false, reason: "throttled", retryAfterMs: gate.retryAfterMs };
	}

	if (!verifyPassword(password, auth.hash)) {
		await throttle.recordFailure(client);
		console.warn(`[auth] failed unlock from ${client}`);
		return { ok: false, reason: "invalid" };
	}

	await throttle.recordSuccess(client);
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

// `changePassword` and `resetPasswordToDefault` live in `auth-file.server.ts`,
// alongside the file format they rewrite, so the password-setting CLI can use
// them without pulling in this module's request-scoped helpers.
