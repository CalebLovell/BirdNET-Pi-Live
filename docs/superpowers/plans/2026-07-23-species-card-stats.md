# Species Card Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first- and last-heard timestamps to Species cards and reorganize all four stats into a clear two-by-two hierarchy.

**Architecture:** Extend the existing `LifeListCard` server data shape in `web-ui/src/lib/detections.ts` with the earliest detection timestamp while retaining the latest timestamp lookup used for audio. Update the existing `SpeciesCard` in `web-ui/src/routes/species.index.tsx` to render counts as primary stats and timestamps as secondary metadata in a responsive two-column grid.

**Tech Stack:** TanStack Start, React, TypeScript, Drizzle ORM, Tailwind CSS, Biome.

## Global Constraints

- Preserve the existing Species card title, illustration, navigation link, audio controls, external links, search, sorting, and pagination.
- Use the existing `detections.Date` and `detections.Time` values; include both when available.
- Render an em dash when a timestamp is unavailable.
- Keep the card readable at its existing minimum grid width without expanding the action area.

---

### Task 1: Extend species card timestamps

**Files:**
- Modify: `web-ui/src/lib/detections.ts:64-139`

**Interfaces:**
- Consumes: Existing `detections` table fields `Date`, `Time`, and `Com_Name`.
- Produces: `LifeListCard.firstDetected: string`, alongside the existing `lastDetected: string`.

- [ ] **Step 1: Add the first timestamp to the card type**

Add `firstDetected: string` beside `lastDetected` in `LifeListCard`.

- [ ] **Step 2: Query the earliest detection per species**

Create an ascending date/time query grouped by species, mirroring the existing latest-record query:

```ts
const earliest = await db
  .select({
    comName: detections.Com_Name,
    date: detections.Date,
    time: detections.Time,
  })
  .from(detections)
  .orderBy(detections.Date, detections.Time);
```

Build a `firstByName` map by keeping the first row encountered for each common name.

- [ ] **Step 3: Return the formatted first timestamp**

For each totals row, read `firstByName.get(row.comName)` and return `firstDetected` using the same `${date} ${time}` format as `lastDetected`, or `""` when no row exists. Keep the existing latest map and audio URL behavior unchanged.

- [ ] **Step 4: Run the typecheck**

Run `npm --prefix web-ui run typecheck`.

Expected: the command exits successfully with no TypeScript errors.

### Task 2: Build the four-stat card hierarchy

**Files:**
- Modify: `web-ui/src/routes/species.index.tsx:267-379`

**Interfaces:**
- Consumes: `LifeListCard.hourCount`, `allTimeCount`, `firstDetected`, and `lastDetected`.
- Produces: A card stats area containing four labeled values in a two-column grid.

- [ ] **Step 1: Add a compact timestamp formatter**

Define a local helper near `SpeciesCard` that formats the stored `YYYY-MM-DD HH:mm:ss`-style value with `Intl.DateTimeFormat`, preserving the original string when parsing fails:

```ts
function formatDetectionTimestamp(value: string) {
  if (!value) return "—";
  const parsed = new Date(value.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}
```

- [ ] **Step 2: Replace the loose stats row with a two-by-two grid**

Render the count stats first using larger `tabular-data text-lg font-semibold` values, then render timestamp stats with `text-sm` values and muted labels. Use a grid such as `grid grid-cols-2 gap-x-4 gap-y-3` and keep the stats section inside the existing flexible content wrapper.

- [ ] **Step 3: Keep actions anchored and links above the card overlay**

Leave the existing action row structure and `relative z-10` behavior intact so the card remains navigable without intercepting button or external-link clicks.

- [ ] **Step 4: Run formatting and validation**

Run `npm --prefix web-ui run format -- src/lib/detections.ts src/routes/species.index.tsx`, then run `npm --prefix web-ui run typecheck` and `npm --prefix web-ui run build`.

Expected: formatting completes, typecheck succeeds, and the production build completes successfully.

