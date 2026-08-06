import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { PageStatus } from "~/components/page-status.tsx";

test("an unavailable status is an alarm, a missing one is not", () => {
	const unavailable = renderToStaticMarkup(
		<PageStatus tone="unavailable" title="Settings unavailable">
			The configuration could not be read.
		</PageStatus>,
	);
	assert.match(unavailable, /text-destructive/);

	const missing = renderToStaticMarkup(
		<PageStatus tone="missing" title="Page not found">
			Nothing lives here.
		</PageStatus>,
	);
	assert.match(missing, /text-muted-foreground/);
	assert.doesNotMatch(missing, /text-destructive/);
});

test("the heading defaults to h1 and drops to h2 beneath a masthead", () => {
	const standalone = renderToStaticMarkup(
		<PageStatus tone="missing" title="Page not found">
			Nothing lives here.
		</PageStatus>,
	);
	assert.match(standalone, /<h1[^>]*>Page not found<\/h1>/);

	const nested = renderToStaticMarkup(
		<PageStatus tone="missing" title="Page not found" heading="h2">
			Nothing lives here.
		</PageStatus>,
	);
	assert.match(nested, /<h2[^>]*>Page not found<\/h2>/);
	assert.doesNotMatch(nested, /<h1/);
});

test("the actions row appears only when there are actions", () => {
	const without = renderToStaticMarkup(
		<PageStatus tone="missing" title="Page not found">
			Nothing lives here.
		</PageStatus>,
	);
	assert.doesNotMatch(without, /data-testid="page-status-actions"/);

	const withActions = renderToStaticMarkup(
		<PageStatus
			tone="missing"
			title="Page not found"
			actions={<button type="button">Try again</button>}
		>
			Nothing lives here.
		</PageStatus>,
	);
	assert.match(withActions, /data-testid="page-status-actions"/);
	assert.match(withActions, />Try again<\/button>/);
});
