// Pure metadata, no server-only imports -- safe for client components (e.g.
// period switchers) to import directly, unlike trend.ts which touches the db.
export const STATS_PERIODS = ["year", "all"] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];

export const STATS_PERIOD_LABELS: Record<StatsPeriod, string> = {
	year: "Last year",
	all: "All Time",
};
