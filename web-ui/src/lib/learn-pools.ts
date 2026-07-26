// Pure metadata, no server-only imports -- safe for the pool switcher on the
// Learn page to import directly, unlike learn.ts which touches the db. Mirrors
// the split used by timeline-periods.ts / timeline.ts.
export const LEARN_POOLS = ["today", "week", "frequent", "all"] as const;
export type LearnPool = (typeof LEARN_POOLS)[number];

export const LEARN_POOL_LABELS: Record<LearnPool, string> = {
	today: "Today",
	week: "This Week",
	frequent: "Regulars",
	all: "All Time",
};

/** Detections all-time a species needs before it counts as a regular. */
export const FREQUENT_SPECIES_THRESHOLD = 25;

export const LEARN_POOL_DESCRIPTIONS: Record<LearnPool, string> = {
	today: "Clips recorded in the last 24 hours.",
	week: "Clips recorded in the last 7 days.",
	frequent: `Species heard at least ${FREQUENT_SPECIES_THRESHOLD} times — the regulars worth knowing cold.`,
	all: "Every species this station has ever recorded.",
};
