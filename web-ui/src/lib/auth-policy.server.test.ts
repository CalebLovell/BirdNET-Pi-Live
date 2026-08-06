import assert from "node:assert/strict";
import test from "node:test";

import {
	defaultPasswordBlocksUnlock,
	isPrivateAddress,
} from "./auth-policy.server.ts";

test("recognises loopback and RFC1918 addresses as private", () => {
	for (const ip of [
		"127.0.0.1",
		"10.0.0.5",
		"172.16.4.1",
		"172.31.255.254",
		"192.168.1.20",
		"::1",
		"fd00::1",
		"::ffff:192.168.1.20",
	]) {
		assert.equal(isPrivateAddress(ip), true, ip);
	}
});

test("treats public and unknown addresses as not private", () => {
	for (const ip of [
		"8.8.8.8",
		"172.32.0.1",
		"203.0.113.7",
		"2606:4700::1111",
		undefined,
		"",
		"nonsense",
	]) {
		assert.equal(isPrivateAddress(ip), false, String(ip));
	}
});

test("the default password may only be used from the local network", () => {
	assert.equal(
		defaultPasswordBlocksUnlock({ isDefault: true }, "192.168.1.20"),
		false,
	);
	assert.equal(
		defaultPasswordBlocksUnlock({ isDefault: true }, "8.8.8.8"),
		true,
	);
	assert.equal(
		defaultPasswordBlocksUnlock({ isDefault: true }, undefined),
		true,
	);
});

test("a real password may be used from anywhere", () => {
	assert.equal(
		defaultPasswordBlocksUnlock({ isDefault: false }, "8.8.8.8"),
		false,
	);
	assert.equal(
		defaultPasswordBlocksUnlock({ isDefault: false }, undefined),
		false,
	);
});
