import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { LearnPoolSelector, LearnRoundShell } from "./learn-layout.tsx";

test("left-aligns the recording-pool selector", () => {
	const markup = renderToStaticMarkup(
		<LearnPoolSelector pool="today" onPoolChange={() => {}} />,
	);

	assert.match(markup, /class="[^"]*justify-start/);
});

test("uses full width for rounds and a compact width for empty states", () => {
	const active = renderToStaticMarkup(
		<LearnRoundShell isEmpty={false}>Round</LearnRoundShell>,
	);
	const empty = renderToStaticMarkup(
		<LearnRoundShell isEmpty>Empty</LearnRoundShell>,
	);

	assert.match(active, /class="[^"]*w-full/);
	assert.doesNotMatch(active, /max-w-3xl/);
	assert.match(empty, /class="[^"]*max-w-3xl/);
});
