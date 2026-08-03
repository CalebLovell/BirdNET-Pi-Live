import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { LearnPoolSelector } from "./learn-layout.tsx";

test("left-aligns the recording-pool selector", () => {
	const markup = renderToStaticMarkup(
		<LearnPoolSelector pool="today" onPoolChange={() => {}} />,
	);

	assert.match(markup, /class="[^"]*justify-start/);
});
