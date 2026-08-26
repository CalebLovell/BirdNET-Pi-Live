import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the root not-found names the path and offers a way out", async () => {
	const source = await readFile(
		new URL("./root-status.tsx", import.meta.url),
		"utf8",
	);
	assert.match(source, /tone="missing"/);
	assert.match(source, /title="Page not found"/);
	assert.match(source, /useRouterState/);
	assert.match(source, /location\.pathname/);
	assert.match(source, /to="\/live"/);
});

test("the root error offers a retry that invalidates the router", async () => {
	const source = await readFile(
		new URL("./root-status.tsx", import.meta.url),
		"utf8",
	);
	assert.match(source, /tone="unavailable"/);
	assert.match(source, /title="This page couldn't load"/);
	assert.match(source, /router\.invalidate\(\)/);
});

test("the root route wires both handlers", async () => {
	const source = await readFile(
		new URL("../routes/__root.tsx", import.meta.url),
		"utf8",
	);
	assert.match(source, /notFoundComponent:\s*RouteNotFound/);
	assert.match(source, /errorComponent:\s*RouteError/);
});
