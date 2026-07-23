# Timeline Design

## Goal

Add a new `/timeline` page showing, for every species with detections in a
chosen time window, a per-hour activity heat map — so you can see at a glance
who's active when across the whole day, for all species at once.

## Data layer

### `web-ui/src/lib/timeline-periods.ts`

Pure metadata, safe for client import (mirrors `stats-periods.ts`):

```ts
export const TIMELINE_PERIODS = ["day", "week", "month", "year", "all"] as const;
export type TimelinePeriod = (typeof TIMELINE_PERIODS)[number];

export const TIMELINE_PERIOD_LABELS: Record<TimelinePeriod, string> = {
  day: "Last 24 Hours",
  week: "Last 7 Days",
  month: "Last 30 Days",
  year: "Last Year",
  all: "All Time",
};
```

### `web-ui/src/lib/timeline.ts`

- `PERIOD_HOURS: Record<TimelinePeriod, number | null>` — `day: 24`,
  `week: 24 * 7`, `month: 24 * 30`, `year: 24 * 365`, `all: null`.
- `periodFilter(period)` — same rolling-window SQL pattern as
  `trend.ts`'s `periodFilter` (`datetime(Date || ' ' || Time) >= datetime('now', '-N hours', 'localtime')`),
  parameterized over `PERIOD_HOURS`. Not shared with `trend.ts` since the
  period sets differ (this page needs sub-day granularity that `StatsPeriod`
  doesn't).
- `getTimelineData(period)` — a `createServerFn`:
  1. One query grouping `detections` by `Com_Name`, `Sci_Name`,
     `strftime('%H', Time)` under `periodFilter(period)`, giving a count per
     species per hour.
  2. Reduce into per-species rows: `hourCounts: number[24]` (zero-filled) and
     `totalDetections` (sum of `hourCounts`).
  3. Sort rows by `totalDetections` descending.
  4. Resolve `imageUrl` (`illustrationUrlFor(sciName) ?? getSpeciesInfo(comName).imageUrl`,
     same fallback chain as `getLifeListCards`) and `ebirdUrl` per species, in
     parallel via `Promise.all`, same cost profile as the existing Species
     index page.
  5. Species with no detections in the period never appear in the grouped
     query result, so no explicit filtering step is needed.

```ts
export type TimelineRow = {
  comName: string;
  sciName: string;
  imageUrl: string | null;
  ebirdUrl: string;
  totalDetections: number;
  hourCounts: number[]; // length 24, index = hour 0-23
};
```

## Shared heat map utility

Extract the existing per-cell color scale out of `species.$sciName.tsx` into
`web-ui/src/lib/heatmap.ts`:

```ts
export const HEAT_COLORS = [...]; // moved as-is from species.$sciName.tsx
export function heatLevel(count: number, maximum: number): number { ... } // moved as-is
```

Update `species.$sciName.tsx` to import both from the new module instead of
defining them locally. No behavior change on that page.

## Route: `web-ui/src/routes/timeline.tsx`

- URL search state: `period` (`TimelinePeriod`, default `"week"`), validated
  with zod and stripped like `statsSearchSchema` in `stats.tsx`.
- `loader` calls `getTimelineData({ data: search.period })`.
- Page header: title "Timeline", subtitle describing daily activity patterns.
- `ToggleGroup` period switcher using `TIMELINE_PERIODS` /
  `TIMELINE_PERIOD_LABELS`, same visual pattern as `stats.tsx`'s period
  switcher (icon + label per option).
- Add a `Timeline` nav link to `Header.tsx` between `Stats` and `Now`.

### Grid layout

One `feature-card` wrapping a horizontally-scrollable CSS grid:

- Column template: a fixed-width left column (species info) + 24 hour
  columns (`minmax(24px, 1fr)` each).
- Header row (sticky top): blank cell over the species column, then 24 hour
  labels (`12a`, `1a`, … `11p`), same `hourLabel`-style short format.
- One row per species (sticky-left species column so it stays visible while
  scrolling horizontally):
  - Left cell: small illustration/thumbnail (~40px), common name (bold),
    scientific name (small italic, `--bark`), and period detection count
    (tabular, muted).
  - 24 hour cells: background color from `HEAT_COLORS[heatLevel(count, rowMax)]`
    where `rowMax` is that species' own busiest hour in the period (per-row
    normalization — every species' pattern is visible regardless of overall
    volume). Each cell has `role="img"`, `aria-label`, and `title` of the form
    `"<Common Name> — <Hour Label>: <count> detections"`.
  - The entire row is a link to `/species/$sciName` (via `sciNameToSlug`),
    using the same absolute-overlay `Link` technique as `SpeciesCard` in
    `species.index.tsx`, so the row is clickable without nesting interactive
    elements inside the link.
- A small legend ("Less" → "More" swatches) below the grid, matching the
  existing calendar heat map's legend.

### Empty state

If `getTimelineData` returns zero rows for the selected period, render a
plain message ("No detections in this period yet.") instead of the grid —
same tone as other empty states in the app (e.g. `species.index.tsx`'s no
search results, `RecentVisitsCard`'s "No visits recorded yet.").

### Responsiveness

- The grid container uses `overflow-x-auto` like the existing calendar heat
  map, so the 24 hour columns scroll horizontally on narrow viewports while
  the species column stays pinned via `position: sticky; left: 0`.
- No pagination or species cap — the full matching list renders, and the
  page scrolls vertically as needed (explicit user choice: show all species
  for the selected time frame, not a top-N subset).

## Out of scope

- No new server-side caching beyond what `getSpeciesInfo` already does.
- No per-species drill-down on the Timeline page itself (clicking a row goes
  to the existing species detail page, which already has an hourly activity
  chart).
- No changes to `trend.ts` or `stats-periods.ts`.

## Validation

- Format changed/new files.
- Run the web UI typecheck.
- Run the production build.
- Manually verify in the browser: period switching, row links, cell
  tooltips, empty state (e.g. switch to "Last 24 Hours" if nothing was
  recently detected), and horizontal scroll behavior on a narrow viewport.
