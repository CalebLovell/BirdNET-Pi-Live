import "@tanstack/react-start/server-only";

import { readFile, writeFile } from "node:fs/promises";
import { isPrivateAddress } from "./auth-policy.server.ts";

export const FREE_ATTEMPTS = 5;
export const MAX_BACKOFF_MS = 900_000;
export const GLOBAL_CEILING = 50;
export const GLOBAL_WINDOW_MS = 900_000;

type IpState = { failures: number; until: number; seen: number };
export type ThrottleState = {
	ips: Record<string, IpState>;
	global: { failures: number; windowStart: number };
};

function emptyState(): ThrottleState {
	return { ips: Object.create(null), global: { failures: 0, windowStart: 0 } };
}

/**
 * Drops addresses that have gone quiet. Without this the map only ever grows:
 * the very attacker the global ceiling anticipates -- one rotating through
 * source addresses -- would add a permanent entry per address, in memory and in
 * the state file on disk, forever.
 *
 * An address is kept while it is still serving a backoff, or while its last
 * failure is recent enough that the escalating ladder should still apply to it.
 * Past that it is indistinguishable from a first-time caller, which is what it
 * effectively is.
 */
function prune(ips: Record<string, IpState>, now: number) {
	const kept: Record<string, IpState> = Object.create(null);
	for (const key of Object.keys(ips)) {
		const entry = ips[key];
		if (entry.until > now || now - entry.seen < GLOBAL_WINDOW_MS) {
			kept[key] = entry;
		}
	}
	return kept;
}

/** `JSON.parse` (and object literals) produce plain objects backed by
 *  `Object.prototype`, so a client address of `__proto__` would otherwise
 *  write to the prototype instead of creating an own property. Rebuild the
 *  map onto a `null`-prototype object and drop any dangerous key names --
 *  including ones from a state file already on disk -- so the address
 *  string can never reach the prototype chain. */
function sanitizeIps(ips: unknown): Record<string, IpState> {
	const safe: Record<string, IpState> = Object.create(null);
	if (!ips || typeof ips !== "object") return safe;
	for (const key of Object.keys(ips)) {
		if (key === "__proto__" || key === "constructor" || key === "prototype")
			continue;
		const value = (ips as Record<string, unknown>)[key] as Partial<IpState>;
		if (
			value &&
			typeof value === "object" &&
			Number.isFinite(value.failures) &&
			Number.isFinite(value.until)
		) {
			// `seen` was added after the first release of this file; an entry
			// without it is treated as last seen now, so it ages out from here
			// rather than being dropped or kept forever.
			safe[key] = {
				failures: value.failures as number,
				until: value.until as number,
				seen: Number.isFinite(value.seen) ? (value.seen as number) : Date.now(),
			};
		}
	}
	return safe;
}

/**
 * Counters are held in memory and mirrored to disk, because the Settings page
 * can restart this service -- an attacker who could reset the throttle by
 * triggering a restart would have no throttle at all.
 */
export class UnlockThrottle {
	readonly #statePath: string;
	readonly #now: () => number;
	#state: ThrottleState | undefined;

	constructor(options: { statePath: string; now?: () => number }) {
		this.#statePath = options.statePath;
		this.#now = options.now ?? Date.now;
	}

	async #load(): Promise<ThrottleState> {
		if (this.#state) return this.#state;
		try {
			const parsed = JSON.parse(await readFile(this.#statePath, "utf8")) as {
				ips?: unknown;
				global?: ThrottleState["global"];
			};
			// `global` is validated field by field rather than trusted for being
			// present: a state file holding `{"global":"x"}` would otherwise turn
			// every counter into NaN and silently disable the ceiling.
			const global = parsed.global as Partial<ThrottleState["global"]>;
			this.#state = {
				ips: sanitizeIps(parsed.ips),
				global:
					global &&
					typeof global === "object" &&
					Number.isFinite(global.failures) &&
					Number.isFinite(global.windowStart)
						? {
								failures: global.failures as number,
								windowStart: global.windowStart as number,
							}
						: { failures: 0, windowStart: 0 },
			};
		} catch {
			// Missing or unreadable state must not lock anyone out; the worst case
			// is that an attacker gets one fresh window.
			this.#state = emptyState();
		}
		return this.#state;
	}

	async #save(state: ThrottleState) {
		this.#state = state;
		try {
			// 0600 like the auth file beside it: this records client addresses
			// and the timing of unlock attempts, which no other local account
			// has any business reading.
			await writeFile(this.#statePath, JSON.stringify(state), {
				encoding: "utf8",
				mode: 0o600,
			});
		} catch {
			// Disk full or read-only: keep throttling from memory rather than
			// turning a logging problem into a lockout.
		}
	}

	async check(ip: string) {
		const state = await this.#load();
		const now = this.#now();

		// The global ceiling exists to stop an attacker who rotates source
		// addresses from evading the per-address backoff -- but that attacker is
		// necessarily coming from off-LAN. Applying the shared counter to local
		// clients too would hand any remote attacker a trivial way to lock the
		// station owner out of their own Pi: keep failing from rotating public
		// addresses and the owner's home-network requests get refused right
		// alongside them.
		const inWindow = now - state.global.windowStart < GLOBAL_WINDOW_MS;
		if (
			!isPrivateAddress(ip) &&
			inWindow &&
			state.global.failures >= GLOBAL_CEILING
		) {
			return {
				allowed: false,
				retryAfterMs: state.global.windowStart + GLOBAL_WINDOW_MS - now,
			};
		}

		const entry = state.ips[ip];
		if (entry && entry.until > now) {
			return { allowed: false, retryAfterMs: entry.until - now };
		}
		return { allowed: true, retryAfterMs: 0 };
	}

	async recordFailure(ip: string) {
		const state = await this.#load();
		const now = this.#now();

		// Only off-LAN failures feed the shared counter -- the owner mistyping
		// their own password on the home network must never push the global
		// ceiling closer to locking the whole station out.
		if (!isPrivateAddress(ip)) {
			if (now - state.global.windowStart >= GLOBAL_WINDOW_MS) {
				state.global = { failures: 0, windowStart: now };
			}
			state.global.failures += 1;
		}

		const failures = (state.ips[ip]?.failures ?? 0) + 1;
		const over = failures - FREE_ATTEMPTS;
		const until =
			over >= 0 ? now + Math.min(MAX_BACKOFF_MS, 30_000 * 2 ** over) : 0;
		state.ips[ip] = { failures, until, seen: now };
		state.ips = prune(state.ips, now);

		await this.#save(state);
	}

	async recordSuccess(ip: string) {
		const state = await this.#load();
		delete state.ips[ip];
		await this.#save(state);
	}
}
