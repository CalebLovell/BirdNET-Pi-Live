import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
	FREE_ATTEMPTS,
	GLOBAL_CEILING,
	UnlockThrottle,
} from "./auth-throttle.server.ts";

async function makeThrottle(clock: { value: number }) {
	const statePath = path.join(
		await mkdtemp(path.join(tmpdir(), "birdnet-throttle-")),
		"throttle.json",
	);
	return {
		statePath,
		throttle: new UnlockThrottle({ statePath, now: () => clock.value }),
	};
}

test("allows the first attempts, then locks the address out", async () => {
	const clock = { value: 1_000 };
	const { throttle } = await makeThrottle(clock);

	for (let attempt = 0; attempt < FREE_ATTEMPTS; attempt += 1) {
		assert.equal((await throttle.check("10.0.0.5")).allowed, true);
		await throttle.recordFailure("10.0.0.5");
	}

	const blocked = await throttle.check("10.0.0.5");
	assert.equal(blocked.allowed, false);
	assert.equal(blocked.retryAfterMs > 0, true);
});

test("backoff grows and eventually expires", async () => {
	const clock = { value: 1_000 };
	const { throttle } = await makeThrottle(clock);

	for (let attempt = 0; attempt <= FREE_ATTEMPTS; attempt += 1) {
		await throttle.recordFailure("10.0.0.5");
	}
	const first = await throttle.check("10.0.0.5");
	assert.equal(first.allowed, false);

	clock.value += first.retryAfterMs + 1;
	assert.equal((await throttle.check("10.0.0.5")).allowed, true);
});

test("one address being throttled does not block another", async () => {
	const clock = { value: 1_000 };
	const { throttle } = await makeThrottle(clock);

	for (let attempt = 0; attempt <= FREE_ATTEMPTS; attempt += 1) {
		await throttle.recordFailure("10.0.0.5");
	}
	assert.equal((await throttle.check("10.0.0.5")).allowed, false);
	assert.equal((await throttle.check("10.0.0.6")).allowed, true);
});

test("success clears that address", async () => {
	const clock = { value: 1_000 };
	const { throttle } = await makeThrottle(clock);

	for (let attempt = 0; attempt <= FREE_ATTEMPTS; attempt += 1) {
		await throttle.recordFailure("10.0.0.5");
	}
	await throttle.recordSuccess("10.0.0.5");
	assert.equal((await throttle.check("10.0.0.5")).allowed, true);
});

test("address rotation still hits the global ceiling", async () => {
	const clock = { value: 1_000 };
	const { throttle } = await makeThrottle(clock);

	for (let attempt = 0; attempt < GLOBAL_CEILING; attempt += 1) {
		await throttle.recordFailure(`203.0.113.${attempt}`);
	}
	assert.equal((await throttle.check("203.0.113.200")).allowed, false);
});

test("a local client is still allowed after the global ceiling has been tripped by remote addresses", async () => {
	const clock = { value: 1_000 };
	const { throttle } = await makeThrottle(clock);

	for (let attempt = 0; attempt < GLOBAL_CEILING; attempt += 1) {
		await throttle.recordFailure(`203.0.113.${attempt}`);
	}
	assert.equal((await throttle.check("192.168.1.50")).allowed, true);
	assert.equal((await throttle.check("203.0.113.200")).allowed, false);
});

test("failures from local addresses do not count toward the global ceiling", async () => {
	const clock = { value: 1_000 };
	const { throttle } = await makeThrottle(clock);

	for (let attempt = 0; attempt < GLOBAL_CEILING; attempt += 1) {
		await throttle.recordFailure(`192.168.1.${attempt}`);
	}
	assert.equal((await throttle.check("203.0.113.1")).allowed, true);
});

test("counters survive a restart", async () => {
	const clock = { value: 1_000 };
	const { statePath, throttle } = await makeThrottle(clock);

	for (let attempt = 0; attempt <= FREE_ATTEMPTS; attempt += 1) {
		await throttle.recordFailure("10.0.0.5");
	}

	const restarted = new UnlockThrottle({ statePath, now: () => clock.value });
	assert.equal((await restarted.check("10.0.0.5")).allowed, false);
});
