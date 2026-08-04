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
