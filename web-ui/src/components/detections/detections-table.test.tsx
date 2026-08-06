import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DetectionsTable } from "~/components/detections/detections-table.tsx";

test("renders every detections column header semibold", () => {
	const markup = renderToStaticMarkup(
		<DetectionsTable
			page={{ rows: [], total: 0 }}
			search={{ page: 1, pageSize: 50, sort: "recorded", direction: "desc" }}
			rowSelection={{}}
			onSearchChange={() => {}}
			onRowSelectionChange={() => {}}
		/>,
	);

	const semiboldHeaders = markup.match(
		/<th[^>]*class="[^"]*font-semibold[^"]*"[^>]*>/g,
	);
	assert.equal(semiboldHeaders?.length, 6);
	for (const label of [
		"Recorded",
		"Species",
		"Scientific name",
		"Confidence",
		"Recording",
	]) {
		assert.match(markup, new RegExp(`>${label}(?:<|$)`));
	}
});

test("orders the detections columns and keeps them all at every width", () => {
	const markup = renderToStaticMarkup(
		<DetectionsTable
			page={{ rows: [], total: 0 }}
			search={{ page: 1, pageSize: 50, sort: "recorded", direction: "desc" }}
			rowSelection={{}}
			onSearchChange={() => {}}
			onRowSelectionChange={() => {}}
		/>,
	);

	const order = [
		...markup.matchAll(
			/>(Species|Scientific name|Recorded|Confidence|Recording)(?:<|$)/g,
		),
	].map((match) => match[1]);
	assert.deepEqual(order, [
		"Species",
		"Scientific name",
		"Recorded",
		"Confidence",
		"Recording",
	]);

	// No column is dropped or restyled per container width.
	assert.doesNotMatch(markup, /data-slot="table-(head|cell)"[^>]*@min-\[/);
	assert.doesNotMatch(
		markup,
		/data-slot="table-(head|cell)"[^>]*class="hidden/,
	);

	// Only the two ends are pinned, by min-width so they hold when the table
	// overflows: the shared selection column and Recording. The columns between
	// divide up the rest under auto layout, so none carries a width, and the
	// table itself is not `table-fixed`.
	const pinned = [...markup.matchAll(/data-slot="table-head" class="([^"]*)"/g)]
		.map((match) => match[1].match(/\bmin-w-\S+/)?.[0] ?? null)
		.filter(Boolean);
	assert.deepEqual(pinned, ["min-w-10", "min-w-32"]);
	assert.doesNotMatch(markup, /data-slot="table"[^>]*table-fixed/);
});
