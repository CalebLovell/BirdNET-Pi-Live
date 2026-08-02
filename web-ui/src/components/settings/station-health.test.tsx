import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { PageHeaderCard } from "~/components/page-header-card.tsx";
import type { StationHealth } from "~/lib/health-data.ts";
import { healthStats } from "./station-health.tsx";

const health: StationHealth = {
	metrics: [
		{
			id: "disk",
			label: "Disk",
			value: "88.0%",
			detail: "used",
			level: "warn",
		},
		{ id: "database", label: "Database", value: "3.08 MB", level: "ok" },
		{
			id: "last-detection",
			label: "Last detection",
			value: "None yet",
			level: "unknown",
		},
	],
};

test("becomes ordinary masthead figures, icon and all", () => {
	const stats = healthStats(health);
	assert.equal(stats.length, 3);
	assert.deepEqual(
		stats.map((stat) => stat.label),
		["Disk", "Database", "Last detection"],
	);
	for (const stat of stats) {
		assert.ok(stat.icon, `${stat.label} needs an icon`);
	}
	// The unit rides in `detail`, the way every other header does it.
	const disk = stats.find((stat) => stat.label === "Disk");
	assert.equal(disk?.value, "88.0%");
	assert.equal(disk?.detail, "used");
});

test("renders through the shared header rather than a panel of its own", () => {
	const markup = renderToStaticMarkup(
		<PageHeaderCard
			title="Settings"
			description="Configure this station."
			stats={healthStats(health)}
		/>,
	);
	// The masthead's own furniture: a definition list of kicker + figure.
	assert.match(markup, /<dl/);
	assert.match(markup, /island-kicker/);
	// Three figures, laid out exactly as the Species masthead's three are.
	assert.match(markup, /lg:grid-cols-3/);
	for (const label of ["Disk", "Database", "Last detection"]) {
		assert.match(markup, new RegExp(`>${label}`));
	}
});

/** Every tone at once, which no single set of real readings is guaranteed to be. */
const allTones = renderToStaticMarkup(
	<PageHeaderCard
		title="Settings"
		description="Configure this station."
		stats={[
			{ label: "Plain", value: 12, icon: () => null },
			{ label: "Fine", value: "12%", icon: () => null, tone: "ok" },
			{ label: "Filling", value: "88%", icon: () => null, tone: "warn" },
			{ label: "Full", value: "99%", icon: () => null, tone: "problem" },
			{ label: "Unread", value: "Unknown", icon: () => null, tone: "unknown" },
		]}
	/>,
);

test("only the figures wanting attention look different", () => {
	assert.match(allTones, /text-destructive/);
	assert.match(allTones, /bg-muted/);
	assert.match(allTones, /var\(--sand\)_35%/);
	// An untoned figure and an `ok` one get the identical disc, so a healthy
	// reading adds no visual noise to a masthead that is mostly healthy.
	assert.equal((allTones.match(/var\(--sage\)_30%/g) ?? []).length, 2);
});

test("states are spoken, not left to colour alone", () => {
	for (const spoken of ["healthy", "problem", "needs attention", "unknown"]) {
		assert.match(allTones, new RegExp(`: ${spoken}</span>`));
	}
	// The untoned figure says nothing extra -- there is no state to report.
	assert.doesNotMatch(allTones, />Plain<span/);
});
