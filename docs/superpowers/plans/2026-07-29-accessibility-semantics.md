# Accessibility Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Birdbook Pi's dialog behavior, semantic HTML, keyboard navigation, screen-reader chart access, table metadata, pagination URLs, and reduced-motion support without changing the visual design.

**Architecture:** Add small shared primitives for Radix dialogs and screen-reader-only data tables, then migrate existing route components onto those contracts. Keep one root `main`, derive section names from real headings, and isolate pathname-focus and pagination calculations in pure helpers so they can be tested without adding a browser test framework.

**Tech Stack:** React 19, TypeScript 6, TanStack Start/Router, Radix UI, Recharts, Tailwind CSS 4, Node test runner with `tsx --test`, Biome, Vite.

## Global Constraints

- Preserve the current field-guide visual design and copy except where accessible labels need clarification.
- Do not implement responsive navigation or narrow-screen row reflow.
- Do not change audio captions, transcripts, sonograms, call descriptions, or player labels in this work.
- Chart and heatmap data alternatives must remain visually hidden with `sr-only`.
- The root document owns the only `main` landmark.
- Layout-only wrappers remain `div`; titled independent cards use `section aria-labelledby`; species result cards use `article aria-labelledby`.
- Use test-driven development: add one focused failing test, observe the expected failure, implement the minimum change, and rerun the focused and full relevant tests.
- Run `npx @tanstack/intent@latest load @tanstack/router-core#router-core/navigation` before editing TanStack pagination or route-navigation code, as required by `web-ui/AGENTS.md`.

---

### Task 1: Shared Radix dialog primitives

**Files:**
- Create: `web-ui/src/components/ui/dialog.tsx`
- Create: `web-ui/src/components/ui/alert-dialog.tsx`
- Create: `web-ui/src/components/ui/dialog.test.tsx`

**Interfaces:**
- Consumes: `Dialog` and `AlertDialog` exports from `radix-ui`, `cn()` from `~/lib/utils.ts`.
- Produces: `Dialog`, `DialogTrigger`, `DialogContent`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`; matching `AlertDialog*` exports including `AlertDialogAction` and `AlertDialogCancel`.

- [ ] **Step 1: Write the failing primitive contract test**

```tsx
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "./dialog.tsx";

test("dialog trigger renders while closed content stays out of the document", () => {
  const markup = renderToStaticMarkup(
    <Dialog>
      <DialogTrigger asChild><button type="button">Open settings</button></DialogTrigger>
      <DialogContent><DialogTitle>Settings</DialogTitle></DialogContent>
    </Dialog>,
  );
  assert.match(markup, />Open settings</);
  assert.doesNotMatch(markup, />Settings</);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/components/ui/dialog.test.tsx`

Expected: FAIL because `./dialog.tsx` does not exist.

- [ ] **Step 3: Implement the shared primitives**

Create thin wrappers using Radix `Portal`, `Overlay`, and `Content`. Preserve the existing overlay and card classes:

```tsx
function DialogContent({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/20" />
      <DialogPrimitive.Content
        className={cn(
          "feature-card fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md p-4 shadow-xl",
          className,
        )}
        {...props}
      />
    </DialogPrimitive.Portal>
  );
}
```

Use equivalent styling for `AlertDialogContent`. Title, description, footer, action, cancel, and close wrappers must forward refs/props through their Radix primitives and add only shared styling.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npm test -- src/components/ui/dialog.test.tsx`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the primitives**

```bash
git add web-ui/src/components/ui/dialog.tsx web-ui/src/components/ui/alert-dialog.tsx web-ui/src/components/ui/dialog.test.tsx
git commit -m "feat: add accessible dialog primitives"
```

### Task 2: Migrate every modal to Radix behavior

**Files:**
- Modify: `web-ui/src/components/review/review-queue-settings.tsx`
- Modify: `web-ui/src/components/review/review-workflow.tsx`
- Modify: `web-ui/src/components/detections/delete-detections-dialog.tsx`
- Modify: `web-ui/src/components/settings/settings-reset.tsx`
- Modify: `web-ui/src/components/settings/station-location.tsx`
- Modify: `web-ui/src/components/review/review-queue-settings.test.tsx`

**Interfaces:**
- Consumes: shared Task 1 `Dialog*` and `AlertDialog*` exports.
- Produces: the same public component props currently consumed by route components; no caller API changes.

- [ ] **Step 1: Add a failing closed-trigger semantics test**

Extend the review queue test to require the dialog-trigger attributes that Radix supplies while keeping the content closed:

```tsx
test("identifies the queue-settings trigger as a closed dialog control", () => {
  const markup = renderToStaticMarkup(
    <ReviewQueueSettings rareSpeciesMax={10} onSave={async () => {}} />,
  );
  assert.match(markup, /aria-haspopup="dialog"/);
  assert.match(markup, /aria-expanded="false"/);
  assert.doesNotMatch(markup, />Rare species threshold</);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/components/review/review-queue-settings.test.tsx`

Expected: FAIL because the current plain button has no `aria-haspopup="dialog"`.

- [ ] **Step 3: Migrate non-destructive dialogs**

Use controlled `Dialog` roots for queue settings, recategorization, and station location. Put the existing button inside `DialogTrigger asChild` where the trigger belongs to the component. Use `DialogTitle`, `DialogDescription`, and `DialogFooter`; use `DialogClose asChild` for cancel/close buttons. Keep `autoFocus` only where a specific input is the intended initial focus.

- [ ] **Step 4: Migrate destructive confirmations**

Use controlled `AlertDialog` roots for review confirmation, deletion confirmation, and settings reset. Use `AlertDialogCancel` and `AlertDialogAction asChild`. When pending, prevent closing and retain disabled buttons. Give inline errors `role="alert"`.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm test -- src/components/review/review-queue-settings.test.tsx src/components/settings/settings-page.test.tsx src/components/settings/station-location.test.tsx`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Browser-check modal behavior**

On Review, Settings, and Detections verify: opening moves focus inside; Tab/Shift+Tab remain inside; Escape closes regular dialogs; background controls cannot receive focus; closing restores focus to the trigger; destructive dialogs retain focus while pending.

- [ ] **Step 7: Commit dialog migrations**

```bash
git add web-ui/src/components/review/review-queue-settings.tsx web-ui/src/components/review/review-workflow.tsx web-ui/src/components/detections/delete-detections-dialog.tsx web-ui/src/components/settings/settings-reset.tsx web-ui/src/components/settings/station-location.tsx web-ui/src/components/review/review-queue-settings.test.tsx
git commit -m "fix: enforce accessible dialog behavior"
```

### Task 3: Root skip link, pathname focus, and landmark cleanup

**Files:**
- Create: `web-ui/src/lib/route-focus.ts`
- Create: `web-ui/src/lib/route-focus.test.ts`
- Modify: `web-ui/src/routes/__root.tsx`
- Modify: `web-ui/src/routes/settings.tsx`
- Modify: `web-ui/src/components/settings/settings-page.tsx`
- Modify: `web-ui/src/components/settings/settings-page.test.tsx`
- Modify: `web-ui/src/styles.css`

**Interfaces:**
- Produces: `shouldMoveRouteFocus(previousPath: string, nextPath: string): boolean`.
- Root contract: skip link targets `#main-content`; root `main` has `id="main-content"` and `tabIndex={-1}`.

- [ ] **Step 1: Write failing route-focus and nested-main tests**

```ts
test("moves focus only when the pathname changes", () => {
  assert.equal(shouldMoveRouteFocus("/today", "/stats"), true);
  assert.equal(shouldMoveRouteFocus("/species", "/species"), false);
});
```

Add to `settings-page.test.tsx`:

```tsx
assert.doesNotMatch(renderToStaticMarkup(<SettingsPage data={data} />), /<main/);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/lib/route-focus.test.ts src/components/settings/settings-page.test.tsx`

Expected: FAIL because the helper is missing and Settings still renders `main`.

- [ ] **Step 3: Implement the pure helper and route wrappers**

```ts
export function shouldMoveRouteFocus(previousPath: string, nextPath: string) {
  return previousPath !== nextPath;
}
```

Replace both Settings route-level `main` elements with `div` wrappers.

- [ ] **Step 4: Add root focus behavior and skip link**

Use `useRouterState` to select `location.pathname`, retain the previous pathname in a ref, skip the initial render, and focus `document.getElementById("main-content")` when `shouldMoveRouteFocus` returns true. Render the skip link immediately before `Header` and the main landmark as:

```tsx
<a className="skip-link" href="#main-content">Skip to main content</a>
<Header />
<main id="main-content" tabIndex={-1} className="flex-1">{children}</main>
```

Add `.skip-link` styles that place it offscreen until `:focus-visible`, then position it above the header with the existing paper, moss, border, and focus tokens.

- [ ] **Step 5: Run focused tests, typecheck, and browser focus checks**

Run: `npm test -- src/lib/route-focus.test.ts src/components/settings/settings-page.test.tsx`

Run: `npm run typecheck`

Expected: PASS.

In the browser, Tab once from a fresh load to reveal the skip link; activate it and confirm `main` owns focus. Navigate Today to Timeline and confirm focus moves to `main`; change only Timeline search parameters and confirm focus stays on the changed control.

- [ ] **Step 6: Commit landmark and focus changes**

```bash
git add web-ui/src/routes/__root.tsx web-ui/src/routes/settings.tsx web-ui/src/components/settings/settings-page.tsx web-ui/src/components/settings/settings-page.test.tsx web-ui/src/lib/route-focus.ts web-ui/src/lib/route-focus.test.ts web-ui/src/styles.css
git commit -m "fix: add skip navigation and route focus"
```

### Task 4: Heading hierarchy, semantic card shells, and definition lists

**Files:**
- Modify: `web-ui/src/routes/today.tsx`
- Modify: `web-ui/src/components/now/current-bird-card.tsx`
- Modify: `web-ui/src/components/now/summary-strip.tsx`
- Modify: `web-ui/src/components/now/recent-log-card.tsx`
- Modify: `web-ui/src/components/species-hero-card.tsx`
- Modify: `web-ui/src/components/species-list.tsx`
- Modify: `web-ui/src/components/species-activity-list.tsx`
- Modify: `web-ui/src/routes/species.index.tsx`
- Modify: `web-ui/src/routes/species.$comName.tsx`
- Modify: `web-ui/src/routes/day.$date.tsx`
- Modify: `web-ui/src/routes/timeline.tsx`
- Modify: `web-ui/src/components/review/review-workflow.tsx`
- Create: `web-ui/src/components/now/summary-strip.test.tsx`
- Create: `web-ui/src/components/species-hero-card.test.tsx`

**Interfaces:**
- Extend `SpeciesHeroCard` with `headingLevel?: 1 | 2`, defaulting to `1` for species detail.
- Each independent card uses a unique heading ID and `section aria-labelledby`.

- [ ] **Step 1: Write failing semantic markup tests**

Render `SpeciesHeroCard` with `headingLevel={2}` and assert `<h2>` is present and `<h1>` is absent. Render `SummaryStrip` with nonempty data and assert the section is labelled by its heading and every term precedes its definition:

```tsx
assert.match(markup, /<section[^>]*aria-labelledby="last-24-hours-title"/);
assert.match(markup, /<h2[^>]*id="last-24-hours-title"/);
assert.ok(markup.indexOf(">Species<") < markup.indexOf(">3<"));
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/components/now/summary-strip.test.tsx src/components/species-hero-card.test.tsx`

Expected: FAIL because the current title is a `div`, `dd` precedes `dt`, and the hero always renders `h1`.

- [ ] **Step 3: Implement Today and shared-card semantics**

Add `<h1 className="sr-only">Today</h1>` before `CurrentBirdCard`. Pass `headingLevel={2}` for both populated and empty Today heroes. Keep the species-detail default at `h1`.

Change `SummaryStrip`, `RecentLogCard`, `SpeciesList`, and `SpeciesActivityList` titles to `h2` with IDs, and replace `aria-label` with `aria-labelledby`. Reorder summary figures to `dt`, `dd`, detail while retaining value-first visuals with Tailwind `order-*` classes if needed.

- [ ] **Step 4: Implement route-card semantics**

Promote the titled labels in day, timeline, species detail, and review cards to `h2` and connect their sections with `aria-labelledby`. Convert the species result card root from `div` to `article aria-labelledby`, using a stable ID derived from its existing species slug. Keep layout grids and untitled wrappers as `div`.

- [ ] **Step 5: Run focused tests and the complete component test set**

Run: `npm test -- src/components/now/summary-strip.test.tsx src/components/species-hero-card.test.tsx`

Run: `npm test`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit semantic markup changes**

```bash
git add web-ui/src/routes/today.tsx web-ui/src/components/now/current-bird-card.tsx web-ui/src/components/now/summary-strip.tsx web-ui/src/components/now/recent-log-card.tsx web-ui/src/components/species-hero-card.tsx web-ui/src/components/species-list.tsx web-ui/src/components/species-activity-list.tsx 'web-ui/src/routes/species.index.tsx' 'web-ui/src/routes/species.$comName.tsx' 'web-ui/src/routes/day.$date.tsx' web-ui/src/routes/timeline.tsx web-ui/src/components/review/review-workflow.tsx web-ui/src/components/now/summary-strip.test.tsx web-ui/src/components/species-hero-card.test.tsx
git commit -m "refactor: align card and heading semantics"
```

### Task 5: Screen-reader-only data tables for Recharts cards

**Files:**
- Create: `web-ui/src/components/accessible-data-table.tsx`
- Create: `web-ui/src/components/accessible-data-table.test.tsx`
- Modify: `web-ui/src/components/detections-by-hour-card.tsx`
- Modify: `web-ui/src/components/detections-over-time-card.tsx`
- Modify: `web-ui/src/routes/day.$date.tsx`

**Interfaces:**
- Produces `AccessibleDataTable({ caption, summary, rowHeaderLabel, columnHeaders, rows })`.
- Row type: `{ label: string; values: Array<string | number> }`.

- [ ] **Step 1: Write the failing accessible-table test**

```tsx
const markup = renderToStaticMarkup(
  <AccessibleDataTable
    caption="Detections by hour data"
    summary="Peak activity occurs at 6 AM."
    rowHeaderLabel="Hour"
    columnHeaders={["Detections"]}
    rows={[{ label: "6 AM", values: [12] }]}
  />,
);
assert.match(markup, /class="sr-only"/);
assert.match(markup, /<caption>Detections by hour data<\/caption>/);
assert.match(markup, /<th scope="row">6 AM<\/th><td>12<\/td>/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/components/accessible-data-table.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the generic hidden table**

Render a `div.sr-only` containing the summary paragraph and a native table with caption, `thead`, one corner header, column headers with `scope="col"`, and row labels with `scope="row"`. Validate row value counts in development by construction rather than runtime throwing.

- [ ] **Step 4: Integrate hourly and trend charts**

Give each card an `h2`, hide the Recharts wrapper with `aria-hidden="true"`, derive a concise summary from the highest data point, and render `AccessibleDataTable` with formatted labels and counts. The day hourly chart follows the same contract. Empty cards render only the existing empty message.

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test -- src/components/accessible-data-table.test.tsx`

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit chart alternatives**

```bash
git add web-ui/src/components/accessible-data-table.tsx web-ui/src/components/accessible-data-table.test.tsx web-ui/src/components/detections-by-hour-card.tsx web-ui/src/components/detections-over-time-card.tsx web-ui/src/routes/day.$date.tsx
git commit -m "feat: expose chart data to screen readers"
```

### Task 6: Replace heatmap cell images with accessible tables

**Files:**
- Create: `web-ui/src/lib/accessible-heatmap.ts`
- Create: `web-ui/src/lib/accessible-heatmap.test.ts`
- Modify: `web-ui/src/routes/timeline.tsx`
- Modify: `web-ui/src/routes/day.$date.tsx`

**Interfaces:**
- Produces `hourColumnLabels(): string[]` and `heatmapTableRows(rows): Array<{ label: string; values: number[] }>` without importing React.
- Consumes Task 5 `AccessibleDataTable`.

- [ ] **Step 1: Write failing heatmap transformation tests**

```ts
test("maps species hour counts into table rows", () => {
  assert.deepEqual(
    heatmapTableRows([{ comName: "Robin", hourCounts: [1, 2] }]),
    [{ label: "Robin", values: [1, 2] }],
  );
});
```

Also assert that `hourColumnLabels()` begins with `12 AM`, `1 AM` and ends with `11 PM`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/lib/accessible-heatmap.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement pure heatmap transformations**

Return copied arrays so presentation components cannot mutate loader data. Keep the hour-label function in one module and import it into both routes.

- [ ] **Step 4: Integrate hidden tables and hide visual grids**

In Timeline and Day, place `aria-hidden="true"` on the visible scrollable heatmap wrapper, remove `role="img"` and cell `aria-label` attributes, and render one `AccessibleDataTable` per heatmap. Captions name the current period or day; row headers are species and columns are the 24 hour labels.

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test -- src/lib/accessible-heatmap.test.ts src/components/accessible-data-table.test.tsx`

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit heatmap alternatives**

```bash
git add web-ui/src/lib/accessible-heatmap.ts web-ui/src/lib/accessible-heatmap.test.ts web-ui/src/routes/timeline.tsx web-ui/src/routes/day.$date.tsx
git commit -m "fix: provide accessible heatmap tables"
```

### Task 7: Detections table caption and sort state

**Files:**
- Create: `web-ui/src/lib/table-sort.ts`
- Create: `web-ui/src/lib/table-sort.test.ts`
- Modify: `web-ui/src/components/detections/detections-table.tsx`

**Interfaces:**
- Produces `ariaSortFor(column, search): "ascending" | "descending" | "none"` and `nextSortLabel(label, column, search): string`.

- [ ] **Step 1: Write failing sort-state tests**

```ts
test("reports current and next sort directions", () => {
  const search = { sort: "recorded", direction: "desc" };
  assert.equal(ariaSortFor("recorded", search), "descending");
  assert.equal(ariaSortFor("species", search), "none");
  assert.equal(nextSortLabel("Recorded", "recorded", search), "Sort Recorded ascending");
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- src/lib/table-sort.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement helpers and table metadata**

Add `<caption className="sr-only">Filtered detections</caption>` directly under `Table`. Apply `aria-sort` to sortable `TableHead` cells using the helper. Give `SortButton` the helper's action label and mark its arrow icon `aria-hidden="true"`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- src/lib/table-sort.test.ts`

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit table metadata**

```bash
git add web-ui/src/lib/table-sort.ts web-ui/src/lib/table-sort.test.ts web-ui/src/components/detections/detections-table.tsx
git commit -m "fix: describe detection table sorting"
```

### Task 8: Real species pagination destinations

**Files:**
- Create: `web-ui/src/lib/species-pagination.ts`
- Create: `web-ui/src/lib/species-pagination.test.ts`
- Modify: `web-ui/src/components/ui/pagination.tsx`
- Modify: `web-ui/src/routes/species.index.tsx`

**Interfaces:**
- Produces `speciesPageSearch(currentSearch, targetPage)` preserving `q`, `sort`, and `reverse` while changing only `page`.
- Extends `PaginationLink` with `asChild?: boolean` using `Slot.Root`, allowing TanStack `Link` to receive the existing pagination styling and ARIA state.
- Produces `PaginationDisabled` as a non-link, `aria-disabled="true"` presentation companion to enabled pagination links.

- [ ] **Step 1: Load required TanStack navigation guidance**

Run: `npx @tanstack/intent@latest load @tanstack/router-core#router-core/navigation`

Read the output before editing the route.

- [ ] **Step 2: Write failing pagination helper tests**

```ts
test("changes only the target page", () => {
  assert.deepEqual(
    speciesPageSearch({ q: "owl", sort: "recent", reverse: true, page: 2 }, 3),
    { q: "owl", sort: "recent", reverse: true, page: 3 },
  );
});
```

- [ ] **Step 3: Run focused test and verify RED**

Run: `npm test -- src/lib/species-pagination.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 4: Implement helper and disabled pagination presentation**

When `PaginationLink` receives `asChild`, render `Slot.Root`; otherwise render `a`. `PaginationDisabled` renders a `span` with the same button variants, `aria-disabled="true"`, and no `tabIndex`. It accepts the same visible children and accessible labels as Previous or Next without an `href`.

- [ ] **Step 5: Replace placeholder anchors with TanStack Links**

Wrap each TanStack `Link` with `PaginationLink asChild`, using `to="/species"` and `search={speciesPageSearch(search, target)}`. Include the existing Chevron and visible Previous/Next text inside those links. Render `PaginationDisabled` with the same Chevron/text at page boundaries. Remove `href="#"`, `preventDefault`, pointer-event disabling, and imperative page navigation from the pagination block. Keep `aria-current="page"` on the active numbered link.

- [ ] **Step 6: Run tests, typecheck, and inspect rendered hrefs**

Run: `npm test -- src/lib/species-pagination.test.ts`

Run: `npm run typecheck`

Expected: PASS.

In the browser, inspect Previous, page numbers, and Next. Confirm each enabled link has a real `/species?...&page=N` destination and boundary controls are non-links with `aria-disabled="true"`.

- [ ] **Step 7: Commit pagination changes**

```bash
git add web-ui/src/lib/species-pagination.ts web-ui/src/lib/species-pagination.test.ts web-ui/src/components/ui/pagination.tsx web-ui/src/routes/species.index.tsx
git commit -m "fix: use real species pagination links"
```

### Task 9: Reduced-motion behavior

**Files:**
- Create: `web-ui/src/styles.test.ts`
- Modify: `web-ui/src/styles.css`

**Interfaces:**
- CSS contract: `@media (prefers-reduced-motion: reduce)` disables named animations and shortens transition/scroll timing.

- [ ] **Step 1: Write the failing stylesheet contract test**

```ts
test("disables nonessential animation for reduced motion", async () => {
  const css = await readFile(new URL("./styles.css", import.meta.url), "utf8");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation-duration:\s*0\.01ms/);
  assert.match(css, /animation-iteration-count:\s*1/);
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- src/styles.test.ts`

Expected: FAIL because the media query is absent.

- [ ] **Step 3: Implement the reduced-motion override**

Add a final media query. Apply `animation-duration: 0.01ms`, `animation-iteration-count: 1`, and `transition-duration: 0.01ms` to `*, *::before, *::after`; set `html { scroll-behavior: auto; }`; set `.rise-in { opacity: 1; transform: none; }`; set `.flash-in { background-color: transparent; }`; and set `.live-dot { opacity: 1; }`. The loading icon remains visible but static.

- [ ] **Step 4: Run focused test and browser preference check**

Run: `npm test -- src/styles.test.ts`

Expected: PASS.

Emulate reduced motion in the browser and confirm the live indicator, fresh-row flash, entrance animation, and loading spinner do not animate while labels and state remain visible.

- [ ] **Step 5: Commit reduced motion support**

```bash
git add web-ui/src/styles.css web-ui/src/styles.test.ts
git commit -m "fix: respect reduced motion preferences"
```

### Task 10: Full verification and rendered accessibility audit

**Files:**
- Modify only files required to correct failures introduced by Tasks 1-9.

**Interfaces:**
- Consumes all prior task contracts.
- Produces a verified accessibility implementation with no responsive or audio-alternative scope expansion.

- [ ] **Step 1: Run the complete automated suite**

Run from `web-ui`:

```bash
npm test
npm run typecheck
cmd /c node_modules\.bin\biome check src
npm run build
```

Expected: tests, typecheck, and build exit 0. For Biome, distinguish pre-existing repository findings from new findings; this task must add no new diagnostics.

- [ ] **Step 2: Run the rendered semantic audit**

Inspect Today, Timeline, Species, one species detail, Detections, Review, Statistics, Settings, and one day route. Confirm:

- Exactly one `main` and one page `h1` per valid route.
- Independent titled cards appear in heading navigation as `h2` sections/articles.
- No visual chart SVG or heatmap cell duplicates the hidden table.
- Hidden tables expose captions, column headers, row headers, and values.
- Detections sortable headers report `aria-sort` and the table has a caption.
- Skip navigation and pathname focus behave as specified.
- All regular and alert dialogs trap and restore focus.
- Species pagination exposes real destinations and non-link boundaries.

- [ ] **Step 3: Review the final diff and scope**

Run:

```bash
git status --short
git diff --check
git diff --stat
```

Confirm no responsive-navigation or audio-alternative changes entered the diff.

- [ ] **Step 4: Commit verification corrections if any**

```bash
git status --short
git commit -m "test: verify accessibility semantics"
```

Stage only the explicit files corrected during verification, using their exact paths from `git status --short`, before committing. Skip this commit when verification required no corrective edits.
