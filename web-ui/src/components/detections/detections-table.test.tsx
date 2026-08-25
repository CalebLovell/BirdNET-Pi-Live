import assert from "node:assert/strict";
import test from "node:test";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { DetectionsTable } from "~/components/detections/detections-table.tsx";

const detection = {
	rowId: 17,
	Date: "2026-08-06",
	Time: "07:14:00",
	Sci_Name: "Cardinalis cardinalis",
	Com_Name: "Northern Cardinal",
	Confidence: 0.94,
	Lat: null,
	Lon: null,
	Cutoff: null,
	Week: null,
	Sens: null,
	Overlap: null,
	File_Name: "Northern_Cardinal-94.wav",
};

async function renderTableWithDetection(canDelete = true) {
	const rootRoute = createRootRoute();
	const indexRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/",
		component: () => (
			<DetectionsTable
				page={{ rows: [detection], total: 1 }}
				search={{
					page: 1,
					pageSize: 50,
					sort: "recorded",
					direction: "desc",
				}}
				rowSelection={{}}
				onSearchChange={() => {}}
				onRowSelectionChange={() => {}}
				canDelete={canDelete}
			/>
		),
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([indexRoute]),
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});
	await router.load();
	return renderToStaticMarkup(<RouterProvider router={router} />);
}

test("renders every detections column header semibold", () => {
	const markup = renderToStaticMarkup(
		<DetectionsTable
			page={{ rows: [], total: 0 }}
			search={{ page: 1, pageSize: 50, sort: "recorded", direction: "desc" }}
			rowSelection={{}}
			onSearchChange={() => {}}
			onRowSelectionChange={() => {}}
			canDelete
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

// The delete path behind these checkboxes is gated on the server, so a locked
// visitor selecting rows could only ever arrive at a refusal.
test("drops the selection checkboxes when the station is locked", async () => {
	const markup = await renderTableWithDetection(false);

	assert.doesNotMatch(markup, /type="checkbox"/);
	assert.doesNotMatch(markup, /Select all detections on this page/);
	assert.doesNotMatch(markup, /aria-label="Select /);
	// The rest of the table is untouched -- only the column comes off.
	assert.match(markup, />Species(?:<|$)/);
	assert.match(markup, />Recording(?:<|$)/);
});

test("keeps the selection checkboxes when the station is unlocked", async () => {
	const markup = await renderTableWithDetection();

	assert.match(markup, /Select all detections on this page/);
	assert.match(markup, /aria-label="Select /);
});

test("keeps the complete table for containers wide enough to fit it", () => {
	const markup = renderToStaticMarkup(
		<DetectionsTable
			page={{ rows: [], total: 0 }}
			search={{ page: 1, pageSize: 50, sort: "recorded", direction: "desc" }}
			rowSelection={{}}
			onSearchChange={() => {}}
			onRowSelectionChange={() => {}}
			canDelete
		/>,
	);
	const desktopTable = markup.match(/<table[\s\S]*<\/table>/)?.[0] ?? "";

	const order = [
		...desktopTable.matchAll(
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

	// The desktop table remains complete; responsive behavior switches the
	// entire presentation rather than dropping individual columns.
	assert.doesNotMatch(
		desktopTable,
		/data-slot="table-(head|cell)"[^>]*@min-\[/,
	);
	assert.doesNotMatch(
		desktopTable,
		/data-slot="table-(head|cell)"[^>]*class="hidden/,
	);

	// Only the two ends are pinned, by min-width so they hold when the table
	// overflows: the shared selection column and Recording. The columns between
	// divide up the rest under auto layout, so none carries a width, and the
	// table itself is not `table-fixed`.
	const pinned = [
		...desktopTable.matchAll(/data-slot="table-head" class="([^"]*)"/g),
	]
		.map((match) => match[1].match(/\bmin-w-\S+/)?.[0] ?? null)
		.filter(Boolean);
	assert.deepEqual(pinned, ["min-w-10", "min-w-32"]);
	assert.doesNotMatch(desktopTable, /data-slot="table"[^>]*table-fixed/);
});

test("renders every detection field and action in a vertical small-screen list", async () => {
	const markup = await renderTableWithDetection();

	// `lg:`, the width the sidebar leaves at, so the two changes land together.
	assert.match(
		markup,
		/data-slot="detections-list" class="[^"]*lg:hidden[^"]*"/,
	);
	assert.match(
		markup,
		/data-slot="table-container" class="[^"]*hidden[^"]*lg:block[^"]*"/,
	);
	assert.match(markup, /aria-label="Select Northern Cardinal"/);
	assert.match(markup, />Northern Cardinal</);
	assert.match(markup, />Cardinalis cardinalis</);
	assert.match(markup, />Scientific name</);
	assert.match(markup, />Recorded</);
	assert.match(markup, />Confidence</);
	assert.match(markup, />94%|>94</);
	assert.match(markup, />Recording</);
	assert.match(markup, /aria-label="Sort detections by"/);
	assert.match(markup, /aria-label="Sort detections ascending"/);
});
