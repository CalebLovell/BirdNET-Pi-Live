import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ReviewQueueSettings } from "./review-queue-settings.tsx";

test("offers the queue threshold as a button rather than an open form", () => {
	const markup = renderToStaticMarkup(
		<ReviewQueueSettings rareSpeciesMax={10} onSave={async () => {}} />,
	);
	assert.match(markup, />Queue settings</);
	// Closed until asked for: the masthead stays a masthead.
	assert.doesNotMatch(markup, /role="dialog"/);
	assert.doesNotMatch(markup, />Rare species threshold</);
});
