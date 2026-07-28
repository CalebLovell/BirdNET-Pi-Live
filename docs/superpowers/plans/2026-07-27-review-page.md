# Review Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/review` page with separate rare-species and low-confidence queues that confirms, recategorizes, or deletes individual detections directly in the existing database.

**Architecture:** Server functions query live SQLite rows by `rowid`, load the active BirdNET species catalog, and perform guarded database/filesystem mutations. A focused React review workflow presents one candidate at a time, requires confirmation for every mutation, and invalidates both queues after success. Human-confirmed or recategorized rows use `Confidence = 1.0` as the only review marker; no schema changes are introduced.

**Tech Stack:** TanStack Start and Router, React 19, TypeScript, Node `node:sqlite`, Drizzle schema metadata, Node filesystem APIs, Tailwind CSS, Node test runner through `tsx`.

## Global Constraints

- Work only on branch `codex/review-page`, created from `main` in the isolated `.worktrees/review-page` worktree.
- Do not add a database table or column.
- Correct and Recategorize set `Confidence = 1.0`; rows at `1.0` are excluded from both queues.
- Correct, Recategorize, and Delete require a confirmation dialog before the server mutation runs.
- Recategorization accepts only an exact scientific/common-name pair from the configured BirdNET catalog.
- Delete and file moves must use resolved paths beneath `BIRDNET_EXTRACTED_DIR`.
- A mutation in either queue must invalidate and refresh both queue counts and candidates.
- Use sequential tests on this Windows host: `npx tsx --test --test-concurrency=1`.
- Preserve unrelated user changes in the main checkout.

---

### Task 1: Restore the baseline and define review-domain helpers

**Files:**
- Modify: `web-ui/src/routes/stats-labels.test.ts`
- Create: `web-ui/src/lib/review-data.ts`
- Create: `web-ui/src/lib/review-data.test.ts`

**Interfaces:**
- Produces: `ReviewQueue = "rare" | "low-confidence"`.
- Produces: `ReviewSearch`, `normalizeReviewSearch(input)`, `SpeciesOption`, `parseSpeciesCatalog(text)`, and `recategorizedFileName(fileName, oldCommonName, newCommonName)`.
- Consumes: `commonNameSafe()` from `web-ui/src/lib/audio.ts` for BirdNET filename normalization.

- [ ] **Step 1: Repair the stale stats label test**

Update the source assertions to match the refactored stats header and extracted chart component:

```ts
const statsRouteSource = await readFile(new URL("./stats.tsx", import.meta.url), "utf8");
const hourlyCardSource = await readFile(
	new URL("../components/detections-by-hour-card.tsx", import.meta.url),
	"utf8",
);

assert.match(statsRouteSource, /label: "Unique species"/);
assert.match(hourlyCardSource, /aria-label="Detections by hour"/);
assert.match(hourlyCardSource, />Detections by hour</);
```

- [ ] **Step 2: Run the repaired baseline test**

Run: `cd web-ui && npx tsx --test --test-concurrency=1 src/routes/stats-labels.test.ts`

Expected: 1 test passes.

- [ ] **Step 3: Write failing review-data tests**

Cover normalization, catalog parsing, and filename replacement:

```ts
test("normalizes review queue and batch size", () => {
	assert.deepEqual(normalizeReviewSearch({ queue: "rare", limit: 40 }), {
		queue: "rare",
		limit: 40,
	});
	assert.deepEqual(normalizeReviewSearch({ queue: "unknown", limit: 999 }), {
		queue: "rare",
		limit: 20,
	});
});

test("parses and sorts the BirdNET species catalog", () => {
	assert.deepEqual(
		parseSpeciesCatalog('{"Turdus migratorius":"American Robin","Cyanocitta cristata":"Blue Jay"}'),
		[
			{ sciName: "Turdus migratorius", comName: "American Robin" },
			{ sciName: "Cyanocitta cristata", comName: "Blue Jay" },
		],
	);
});

test("renames only the BirdNET species prefix", () => {
	assert.equal(
		recategorizedFileName(
			"American_Robin-90-2026-07-27-birdnet-06:00:00.mp3",
			"American Robin",
			"Blue Jay",
		),
		"Blue_Jay-90-2026-07-27-birdnet-06:00:00.mp3",
	);
});
```

- [ ] **Step 4: Run the review-data tests and verify RED**

Run: `cd web-ui && npx tsx --test --test-concurrency=1 src/lib/review-data.test.ts`

Expected: FAIL because `review-data.ts` exports do not exist.

- [ ] **Step 5: Implement the pure helpers**

Use these exact types and boundaries:

```ts
export const REVIEW_QUEUES = ["rare", "low-confidence"] as const;
export type ReviewQueue = (typeof REVIEW_QUEUES)[number];
export type ReviewSearch = { queue: ReviewQueue; limit: number };
export type SpeciesOption = { sciName: string; comName: string };

export function normalizeReviewSearch(input: Record<string, unknown>): ReviewSearch {
	const queue = REVIEW_QUEUES.includes(input.queue as ReviewQueue)
		? (input.queue as ReviewQueue)
		: "rare";
	const limit =
		typeof input.limit === "number" && input.limit >= 20 && input.limit <= 200 && input.limit % 20 === 0
			? input.limit
			: 20;
	return { queue, limit };
}
```

`parseSpeciesCatalog` parses the English localization JSON, discards blank names, and sorts by `comName` using `localeCompare`. `recategorizedFileName` requires the filename to start with `${commonNameSafe(oldCommonName)}-`; otherwise it returns `null`.

- [ ] **Step 6: Run Task 1 tests and verify GREEN**

Run: `cd web-ui && npx tsx --test --test-concurrency=1 src/routes/stats-labels.test.ts src/lib/review-data.test.ts`

Expected: all tests pass.

- [ ] **Step 7: Commit Task 1**

```powershell
git add web-ui/src/routes/stats-labels.test.ts web-ui/src/lib/review-data.ts web-ui/src/lib/review-data.test.ts
git commit -m "test: restore baseline and define review data"
```

### Task 2: Query live review queues and load the species catalog

**Files:**
- Create: `web-ui/src/lib/review.server.ts`
- Create: `web-ui/src/lib/review.server.test.ts`
- Create: `web-ui/src/lib/review.ts`

**Interfaces:**
- Consumes: `ReviewSearch`, `SpeciesOption`, and `parseSpeciesCatalog` from Task 1.
- Produces: `ReviewCandidate`, `ReviewPage`, `loadReviewPage(database, extractedRoot, search)`, and `loadSpeciesCatalog(labelsPath?)`.
- Produces server functions `getReviewPage` and `getReviewSpecies`.

- [ ] **Step 1: Write failing queue integration tests**

Create a temporary SQLite database with the production `detections` columns and fixtures that prove:

```ts
test("rare queue ranks species by lifetime count and picks one weakest eligible clip", () => {
	const page = loadReviewPage(database, extractedRoot, { queue: "rare", limit: 20 });
	assert.deepEqual(
		page.candidates.map(({ comName, fileName }) => [comName, fileName]),
		[["Scarlet Tanager", "tanager-low.mp3"], ["Blue Jay", "jay-low.mp3"]],
	);
});

test("low-confidence queue puts null first and excludes human-confirmed rows", () => {
	const page = loadReviewPage(database, extractedRoot, {
		queue: "low-confidence",
		limit: 20,
	});
	assert.deepEqual(page.candidates.map((row) => row.confidence), [null, 0.21, 0.4]);
	assert.ok(page.candidates.every((row) => row.confidence !== 1));
});
```

Also assert `rareTotal`, `lowConfidenceTotal`, `audioUrl`, `audioAvailable`, and `ebirdUrl`.

- [ ] **Step 2: Run queue tests and verify RED**

Run: `cd web-ui && npx tsx --test --test-concurrency=1 src/lib/review.server.test.ts`

Expected: FAIL because the server query module does not exist.

- [ ] **Step 3: Implement queue queries**

Define:

```ts
export type ReviewCandidate = {
	rowId: number;
	date: string;
	time: string;
	sciName: string;
	comName: string;
	confidence: number | null;
	fileName: string;
	lifetimeCount: number;
	audioUrl: string;
	audioAvailable: boolean;
	ebirdUrl: string;
};

export type ReviewPage = {
	queue: ReviewQueue;
	limit: number;
	rareTotal: number;
	lowConfidenceTotal: number;
	candidates: ReviewCandidate[];
};
```

Use a window query for the rare queue:

```sql
WITH lifetime AS (
  SELECT Sci_Name, Com_Name, COUNT(*) AS lifetime_count
  FROM detections GROUP BY Sci_Name, Com_Name
), ranked AS (
  SELECT d.rowid AS row_id, d.*,
    lifetime.lifetime_count,
    ROW_NUMBER() OVER (
      PARTITION BY d.Sci_Name, d.Com_Name
      ORDER BY d.Confidence IS NOT NULL, d.Confidence ASC, d.Date DESC, d.Time DESC
    ) AS candidate_rank
  FROM detections d
  JOIN lifetime USING (Sci_Name, Com_Name)
  WHERE d.Confidence IS NULL OR d.Confidence < 1.0
)
SELECT * FROM ranked
WHERE candidate_rank = 1
ORDER BY lifetime_count ASC, Com_Name ASC
LIMIT ?
```

The low-confidence query orders by `Confidence IS NOT NULL`, confidence ascending, then date/time descending. Compute both total counts independently of the active queue. Check audio availability with `existsSync(resolveDetectionClipPath(...))`.

- [ ] **Step 4: Implement species catalog loading**

`loadSpeciesCatalog()` reads, in order:

1. `BIRDNET_LABELS_PATH` when set.
2. `../model/labels.txt` when present; parse each `scientific_common` line.
3. `../model/l18n/labels_en.json` as the repository fallback.

Return `SpeciesOption[]` sorted by common name. Throw a concise error if none is readable.

- [ ] **Step 5: Add TanStack server wrappers**

In `review.ts`, expose:

```ts
export const getReviewPage = createServerFn({ method: "GET" })
	.validator((input: Record<string, unknown>) => normalizeReviewSearch(input))
	.handler(({ data }) => loadReviewPage(sqlite, extractedDir(), data));

export const getReviewSpecies = createServerFn({ method: "GET" }).handler(
	() => loadSpeciesCatalog(),
);
```

- [ ] **Step 6: Run Task 2 tests and verify GREEN**

Run: `cd web-ui && npx tsx --test --test-concurrency=1 src/lib/review-data.test.ts src/lib/review.server.test.ts`

Expected: all tests pass.

- [ ] **Step 7: Commit Task 2**

```powershell
git add web-ui/src/lib/review.server.ts web-ui/src/lib/review.server.test.ts web-ui/src/lib/review.ts
git commit -m "feat: query detection review queues"
```

### Task 3: Implement confirmed direct mutations

**Files:**
- Modify: `web-ui/src/lib/review.server.ts`
- Modify: `web-ui/src/lib/review.server.test.ts`
- Modify: `web-ui/src/lib/review.ts`

**Interfaces:**
- Produces: `correctDetection(database, rowId)`, `recategorizeDetection(database, extractedRoot, rowId, species)`, and `deleteDetectionDirectly(database, extractedRoot, rowId)`.
- Produces server functions `confirmReviewDetection`, `recategorizeReviewDetection`, and `deleteReviewDetection`.

- [ ] **Step 1: Write failing mutation integration tests**

Use a temp database and real temp audio/spectrogram files to assert:

```ts
test("correct marks exactly one row as human-confirmed", () => {
	correctDetection(database, targetRowId);
	assert.equal(readRow(database, targetRowId).Confidence, 1);
});

test("recategorize moves assets and updates names, filename, and confidence", async () => {
	await recategorizeDetection(database, extractedRoot, targetRowId, {
		sciName: "Cyanocitta cristata",
		comName: "Blue Jay",
	});
	const changed = readRow(database, targetRowId);
	assert.equal(changed.Sci_Name, "Cyanocitta cristata");
	assert.equal(changed.Com_Name, "Blue Jay");
	assert.equal(changed.Confidence, 1);
	assert.match(changed.File_Name, /^Blue_Jay-/);
});
```

Also test unsupported species rejection, unsafe old filename rejection, occupied destination rejection, missing row, missing audio, database rollback with files restored, deletion of unreferenced audio/spectrogram, and preservation of shared assets.

- [ ] **Step 2: Run mutation tests and verify RED**

Run: `cd web-ui && npx tsx --test --test-concurrency=1 src/lib/review.server.test.ts`

Expected: FAIL because mutation functions are not implemented.

- [ ] **Step 3: Implement Correct**

Validate `rowId` with `Number.isSafeInteger(rowId) && rowId > 0`. Open a writable connection in the server wrapper, execute `BEGIN IMMEDIATE`, update by `rowid`, require `changes === 1`, commit, and close. Roll back on any error.

- [ ] **Step 4: Implement Recategorize**

Use the following order:

1. Validate selected species against `loadSpeciesCatalog()` before any write.
2. Read the target row by `rowid` from the writable connection.
3. Derive the new filename with `recategorizedFileName`; reject `null`.
4. Resolve old and new paths with `resolveDetectionClipPath`.
5. Require the old audio to exist and the new audio/spectrogram destinations not to exist.
6. Create the destination directory, move audio, and move `${audio}.png` only when present.
7. Transactionally update `Sci_Name`, `Com_Name`, `File_Name`, and `Confidence = 1.0` by `rowid`.
8. On database failure, move all moved assets back and report rollback failure distinctly.

Use `mkdir`, `rename`, and `stat` from `node:fs/promises`; never build shell commands.

- [ ] **Step 5: Implement Delete**

Move the existing single-row deletion semantics into a reusable helper or implement the same safe sequence in `review.server.ts`: transactionally delete by `rowid`, count remaining references by date/common-name/filename, then remove audio and `${audio}.png` only when unreferenced. Return `{ deletedRecords, deletedFiles, missingFiles, failedFiles }`.

- [ ] **Step 6: Add validated server functions**

Use payloads:

```ts
type ReviewRowRequest = { rowId: number };
type RecategorizeRequest = ReviewRowRequest & { sciName: string; comName: string };
```

The handlers open and close writable database connections and never accept file paths from the browser.

- [ ] **Step 7: Run mutation tests and verify GREEN**

Run: `cd web-ui && npx tsx --test --test-concurrency=1 src/lib/review.server.test.ts`

Expected: all queue and mutation tests pass.

- [ ] **Step 8: Commit Task 3**

```powershell
git add web-ui/src/lib/review.server.ts web-ui/src/lib/review.server.test.ts web-ui/src/lib/review.ts
git commit -m "feat: mutate reviewed detections safely"
```

### Task 4: Build the focused review interaction

**Files:**
- Create: `web-ui/src/components/review/review-card.tsx`
- Create: `web-ui/src/components/review/review-confirmation-dialog.tsx`
- Create: `web-ui/src/components/review/species-picker.tsx`
- Create: `web-ui/src/components/review/review-workflow.tsx`

**Interfaces:**
- Consumes: `ReviewCandidate`, `ReviewPage`, and `SpeciesOption` from Tasks 1-2.
- Consumes mutation server functions from Task 3 through callbacks supplied by the route.
- Produces: `ReviewWorkflow({ page, species, onCorrect, onRecategorize, onDelete, onLoadMore, busy })`.

- [ ] **Step 1: Add a source-level interaction contract test**

Create `web-ui/src/components/review/review-workflow.test.ts` that reads the four TSX sources and asserts the required accessible labels and action copy exist: `Correct`, `Recategorize`, `Delete`, `Skip`, `Open eBird reference`, `Confirm correction`, and `Cancel`.

- [ ] **Step 2: Run the interaction contract and verify RED**

Run: `cd web-ui && npx tsx --test --test-concurrency=1 src/components/review/review-workflow.test.ts`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement the confirmation dialog**

Follow the existing `DeleteDetectionsDialog` overlay and `role="alertdialog"` pattern. Accept `title`, `description`, `confirmLabel`, `variant`, `pending`, `onCancel`, and `onConfirm`. Disable both dismissal and duplicate submission while pending.

- [ ] **Step 4: Implement the searchable species picker**

Use the existing `Input`, `Button`, and Fuse.js dependency. Filter on common and scientific names, cap visible results at 100, use actual buttons rather than a custom combobox, and expose the selected `SpeciesOption` to the workflow. The picker remains inside a modal dialog with Escape/cancel behavior.

- [ ] **Step 5: Implement the review card**

The card renders the species identity, date/time, confidence pill, rare lifetime count when applicable, `RecordingButton`, an external eBird link with `target="_blank" rel="noreferrer"`, missing-audio notice, and the four actions. Disable Correct and Recategorize when `audioAvailable` is false.

- [ ] **Step 6: Implement workflow state**

Track the current index, skipped row IDs, pending action, feedback, and selected replacement. Skip advances without a server call. A successful mutation advances, clears modal state, and lets the route invalidate. When the current batch is exhausted, show Load more or the all-caught-up state.

- [ ] **Step 7: Run the interaction contract and verify GREEN**

Run: `cd web-ui && npx tsx --test --test-concurrency=1 src/components/review/review-workflow.test.ts`

Expected: pass.

- [ ] **Step 8: Commit Task 4**

```powershell
git add web-ui/src/components/review
git commit -m "feat: add focused detection review workflow"
```

### Task 5: Wire the route, navigation, and router generation

**Files:**
- Create: `web-ui/src/routes/review.tsx`
- Modify: `web-ui/src/components/Header.tsx`
- Modify generated: `web-ui/src/routeTree.gen.ts`

**Interfaces:**
- Consumes all server functions and `ReviewWorkflow` from Tasks 2-4.
- Produces user-visible `/review` route with validated `{ queue, limit }` search state.

- [ ] **Step 1: Write a failing route contract test**

Create `web-ui/src/routes/review-route.test.ts` that reads route and header sources and asserts `/review`, `Review detections`, `Rare species`, `Low confidence`, and `router.invalidate()` are wired.

- [ ] **Step 2: Run route contract and verify RED**

Run: `cd web-ui && npx tsx --test --test-concurrency=1 src/routes/review-route.test.ts`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the route loader and page header**

Use `normalizeReviewSearch` in `validateSearch`, strip defaults `{ queue: "rare", limit: 20 }`, load `getReviewPage` and `getReviewSpecies` together, and render `PageHeaderCard` with live queue totals. Tabs update `queue` and reset `limit` to 20. Load more increments limit by 20 up to 200.

- [ ] **Step 4: Wire mutation callbacks**

Use `useServerFn` for the three POST functions. Each callback awaits the mutation and then `await router.invalidate()`. Surface partial file cleanup as feedback rather than hiding it.

- [ ] **Step 5: Add Review to the header**

Place Review between Detections and Learn, using the existing `nav-link` and active-props pattern.

- [ ] **Step 6: Regenerate the route tree**

Run: `cd web-ui && npm run generate-routes`

Expected: `routeTree.gen.ts` contains `/review` imports and route types.

- [ ] **Step 7: Run the route contract and typecheck**

Run:

```powershell
cd web-ui
npx tsx --test --test-concurrency=1 src/routes/review-route.test.ts
npm run typecheck
```

Expected: both commands pass.

- [ ] **Step 8: Commit Task 5**

```powershell
git add web-ui/src/routes/review.tsx web-ui/src/routes/review-route.test.ts web-ui/src/components/Header.tsx web-ui/src/routeTree.gen.ts
git commit -m "feat: add detection review page"
```

### Task 6: Full verification and branch handoff

**Files:**
- Modify only files required by verification findings.

**Interfaces:**
- Consumes the complete feature.
- Produces a verified branch ready for user review.

- [ ] **Step 1: Run all tests sequentially**

Run: `cd web-ui && npx tsx --test --test-concurrency=1`

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run static checks**

Run:

```powershell
cd web-ui
npm run typecheck
npx biome check src
```

Expected: TypeScript exits 0 and Biome reports no errors.

- [ ] **Step 3: Run the production build**

Run: `cd web-ui && npm run build`

Expected: Vite/Nitro production build exits 0.

- [ ] **Step 4: Inspect the final diff and branch state**

Run:

```powershell
git status --short
git diff main...HEAD --check
git diff main...HEAD --stat
```

Expected: no unstaged implementation changes, no whitespace errors, and only review-page plus baseline-test files differ.

- [ ] **Step 5: Commit any verification-only fixes**

If verification required fixes, stage only those exact files and commit:

```powershell
git commit -m "fix: finalize detection review workflow"
```

- [ ] **Step 6: Report the branch and verification evidence**

Report `codex/review-page`, the isolated worktree path, test count, typecheck, Biome, build result, and the direct database mutations implemented. Do not merge or push unless the user asks.
