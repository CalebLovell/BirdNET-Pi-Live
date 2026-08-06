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
import {
	SpeciesControlTable,
	type SpeciesControlViewRow,
	sortSpeciesControlRows,
} from "./species-control-table.tsx";

function row(
	comName: string,
	sciName: string,
	status: SpeciesControlViewRow["status"],
	detections = 0,
): SpeciesControlViewRow {
	return {
		comName,
		sciName,
		status,
		custom: status === "custom",
		excluded: status === "never",
		whitelisted: status === "always",
		history: {
			detections,
			maxConfidence: null,
			lastSeen: null,
			recordings: 0,
		},
	};
}

const rows = [
	row("Coyote", "Canis latrans", "automatic", 4),
	row("Gray squirrel", "Sciurus carolinensis", "custom"),
	row("Raccoon", "Procyon lotor", "always"),
	row("Opossum", "Didelphis virginiana", "never"),
];

async function renderTable(
	props: Partial<React.ComponentProps<typeof SpeciesControlTable>> = {},
) {
	const rootRoute = createRootRoute();
	const indexRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/",
		component: () => (
			<SpeciesControlTable
				rows={rows}
				page={1}
				pageCount={1}
				total={rows.length}
				selected={new Set()}
				sort="species"
				direction="asc"
				onSortChange={() => {}}
				onSelectedChange={() => {}}
				onPageChange={() => {}}
				{...props}
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

test("renders Installed species with five sortable, unified columns", async () => {
	const markup = await renderTable();

	for (const slot of [
		"table",
		"table-header",
		"table-body",
		"table-row",
		"table-head",
		"table-cell",
		"badge",
	]) {
		assert.match(markup, new RegExp(`data-slot="${slot}"`));
	}
	assert.equal(markup.match(/data-slot="table-head"/g)?.length, 5);
	assert.equal(markup.match(/data-slot="table-cell"/g)?.length, 20);
	assert.equal(markup.match(/font-semibold/g)?.length, 5);
	for (const heading of ["Species", "Scientific name", "Count", "Status"]) {
		assert.match(markup, new RegExp(`>${heading}(?:<|$)`));
	}
	for (const status of [
		"Automatic",
		"Custom",
		"Always detect",
		"Never detect",
	]) {
		assert.match(markup, new RegExp(`>${status}<`));
	}
	assert.match(markup, /bg-muted text-muted-foreground/);
	assert.match(markup, /var\(--sage\)/);
	assert.match(markup, /var\(--sand\)/);
	assert.match(markup, /var\(--clay\)/);
	assert.doesNotMatch(markup, /<select/);
	assert.doesNotMatch(markup, />Policy</);
	assert.match(markup, /aria-sort="none"[^>]*><button[^>]*>Scientific name/);
	assert.match(markup, /aria-sort="none"[^>]*><button[^>]*>Status/);
	assert.match(markup, /hover:bg-muted\/50/);
	assert.match(markup, /opacity-35/);
	assert.match(
		markup,
		/<a href="\/species\/coyote" class="font-medium no-underline hover:underline">Coyote<\/a>/,
	);
	// Every column renders at every width -- no column is dropped or restyled
	// per container width.
	assert.doesNotMatch(markup, /<colgroup/);
	assert.doesNotMatch(markup, /data-slot="table-(head|cell)"[^>]*@min-\[/);
	assert.doesNotMatch(
		markup,
		/data-slot="table-(head|cell)"[^>]*class="hidden/,
	);
	// Only the two ends are pinned -- the shared selection column and status --
	// and both are pinned by min-width, not just width, so they hold when the
	// table overflows. Everything between divides up the rest under auto layout,
	// so no middle column carries a width of its own.
	assert.match(
		markup,
		/data-slot="table-head" class="[^"]*\bw-10 min-w-10\b[^"]*"[^>]*><input aria-label="Select all species/,
	);
	assert.match(
		markup,
		/data-slot="table-head" class="[^"]*\bw-36 min-w-36\b[^"]*" aria-sort="none"[^>]*><button[^>]*>Status/,
	);
	assert.doesNotMatch(
		markup,
		/data-slot="table-head" class="[^"]*\bw-\d+[^"]*" aria-sort="ascending"/,
	);
	assert.match(
		markup,
		/data-slot="table-head" class="[^"]*pl-0[^"]*" aria-sort="ascending"/,
	);
	assert.match(
		markup,
		/data-slot="table-head" class="[^"]*pl-1[^"]*" aria-sort="none"/,
	);
	assert.match(markup, /data-slot="table-cell" class="[^"]*pl-0[^"]*"/);
	assert.match(markup, /data-slot="table-cell" class="[^"]*pl-1[^"]*"/);
});

test("left-aligns selection controls within their column", async () => {
	const markup = await renderTable();

	assert.match(
		markup,
		/data-slot="table-head" class="[^"]*text-left[^"]*"[^>]*><input aria-label="Select all species on this page"/,
	);
	assert.match(
		markup,
		/data-slot="table-cell" class="[^"]*text-left[^"]*"[^>]*><input aria-label="Select Coyote"/,
	);
	assert.doesNotMatch(markup, /class="mx-auto block size-3\.5/);
});

test("sorts scientific names and statuses in their natural orders", () => {
	assert.deepEqual(
		sortSpeciesControlRows(rows, "scientific", "asc").map(
			(item) => item.sciName,
		),
		[
			"Canis latrans",
			"Didelphis virginiana",
			"Procyon lotor",
			"Sciurus carolinensis",
		],
	);
	assert.deepEqual(
		sortSpeciesControlRows(rows, "scientific", "desc").map(
			(item) => item.sciName,
		),
		[
			"Sciurus carolinensis",
			"Procyon lotor",
			"Didelphis virginiana",
			"Canis latrans",
		],
	);
	assert.deepEqual(
		sortSpeciesControlRows(rows, "status", "asc").map((item) => item.status),
		["automatic", "custom", "always", "never"],
	);
});
