// Pure metadata, no server-only imports -- safe for client components (e.g.
// the period switcher) to import directly, unlike timeline.ts which touches
// the db. Mirrors the split used by stats-periods.ts / trend.ts.
export const TIMELINE_PERIODS = [
	"day",
	"week",
	"month",
	"year",
	"all",
] as const;
export type TimelinePeriod = (typeof TIMELINE_PERIODS)[number];

export const TIMELINE_PERIOD_LABELS: Record<TimelinePeriod, string> = {
	day: "Last 24 Hours",
	week: "Last 7 Days",
	month: "Last 30 Days",
	year: "Last Year",
	all: "All Time",
};
