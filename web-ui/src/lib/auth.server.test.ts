import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { MIN_PASSWORD_LENGTH, readAuthFile, verifyPassword } from "./auth-file.server.ts";
import { changePassword, rotateSessionNonce } from "./auth.server.ts";

async function useFixtureAuthFile() {
	const file = path.join(await mkdtemp(path.join(tmpdir(), "birdnet-auth-svc-")), "web-ui-auth.conf");
	process.env.BIRDNET_AUTH_CONF = file;
	return file;
}

test("changing the password clears the default flag and rotates the nonce", async () => {
	const file = await useFixtureAuthFile();
	const before = await readAuthFile(file);
	assert.equal(before.isDefault, true);

	await changePassword("swifts-over-the-creek");

	const after = await readAuthFile(file);
	assert.equal(after.isDefault, false);
	assert.equal(verifyPassword("swifts-over-the-creek", after.hash), true);
	assert.notEqual(after.nonce, before.nonce);
});

test("rejects a password under the minimum length", async () => {
	await useFixtureAuthFile();
	await assert.rejects(() => changePassword("a".repeat(MIN_PASSWORD_LENGTH - 1)), /at least 12/);
});

test("rotating the nonce leaves the password alone", async () => {
	const file = await useFixtureAuthFile();
	await changePassword("swifts-over-the-creek");
	const before = await readAuthFile(file);

	await rotateSessionNonce();

	const after = await readAuthFile(file);
	assert.notEqual(after.nonce, before.nonce);
	assert.equal(after.hash, before.hash);
});
