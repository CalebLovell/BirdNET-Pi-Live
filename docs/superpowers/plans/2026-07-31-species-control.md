# Species Control Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independent browser workspace that safely manages BirdNET-Pi's include, exclude, and whitelist species policies, previews geographic eligibility, exposes detection history, and supports confirmed species-history cleanup.

**Architecture:** Load the active installed model catalog and three legacy list files through a server-only persistence module, then send the complete catalog plus compact history aggregates to a client-paginated React workspace. Keep policy transitions pure and client-safe, save all staged changes through revision-checked atomic file replacement, run geographic preview through a fixed Python entry point, and keep destructive history deletion behind a separate server contract and dialog.

**Tech Stack:** TanStack Start/Router, React 19, TypeScript 6, Zod 4, Fuse.js, TanStack Table, Node `fs`/`crypto`/`sqlite`, Python/TFLite range model, Tailwind CSS 4, Node test runner, Biome.

## Global Constraints

- Preserve all pre-existing user changes, especially the in-progress Settings/health work; do not edit Settings files.
- `include_species_list.txt`, `exclude_species_list.txt`, and `whitelist_species_list.txt` remain the runtime source of truth.
- Only installed-model labels may be added; unknown existing lines survive until explicitly removed.
- A nonempty include list activates Custom-only mode; exclude wins over include and whitelist; whitelist bypasses only geographic filtering.
- Policy edits are staged and saved together; history deletion is always separate.
- No arbitrary client-provided paths, commands, configuration keys, or raw file contents reach privileged operations.
- Use `BIRDNET_SPECIES_LIST_DIR`, `BIRDNET_MODEL_DIR`, `BIRDNET_CONF`, `BIRDNET_DB_PATH`, and `BIRDNET_EXTRACTED_DIR` for fixture isolation.
- Use existing styles and components; do not add dependencies or alter global CSS.

---

### Task 1: Define client-safe policy contracts

**Files:**
- Create: `web-ui/src/lib/species-control-data.ts`
- Create: `web-ui/src/lib/species-control-data.test.ts`

**Interfaces:**
- Produces `SpeciesPolicy`, `SpeciesControlRow`, `SpeciesControlPageData`, `SpeciesControlSaveInput`, `SpeciesRangePreview`, `HistoryDeletePreview`, `effectiveSpeciesState()`, `applySpeciesPolicy()`, `normalizeSpeciesControlSave()`, and exact Zod save/delete schemas.
- Consumes no server-only modules.

- [ ] **Step 1: Write failing policy tests** covering the actual analysis precedence, Always/Never mutual exclusion, Never clearing Custom, Always adding Custom while restricted, stable deduplication, input limits, and invalid scientific names.

```ts
test("excluded wins over custom and whitelist", () => {
  assert.deepEqual(effectiveSpeciesState({
    customMode: true, custom: true, excluded: true, whitelisted: true,
    geographicallyEligible: true,
  }), { outcome: "blocked", reason: "Excluded" });
});

test("never detect clears conflicting memberships", () => {
  assert.deepEqual(applySpeciesPolicy({ custom: true, policy: "always" }, "never", true),
    { custom: false, policy: "never" });
});
```

- [ ] **Step 2: Run `npm test -- src/lib/species-control-data.test.ts` from `web-ui/`** and confirm RED because the module is absent.
- [ ] **Step 3: Implement immutable helpers and Zod schemas** with maximum 7,000 entries per known list, 1,000 unresolved-removal tokens, trimmed exact scientific names, and duplicate elimination.
- [ ] **Step 4: Re-run the focused test** and confirm GREEN.
- [ ] **Step 5: Commit only Task 1 files** with `feat: define species control policies`.

---

### Task 2: Load the installed catalog and legacy lists

**Files:**
- Create: `web-ui/src/lib/species-control.server.ts`
- Create: `web-ui/src/lib/species-control.server.test.ts`

**Interfaces:**
- Produces `resolveSpeciesListDirectory()`, `resolveSpeciesModelDirectory()`, `parseSpeciesList()`, `loadInstalledSpeciesCatalog()`, `loadSpeciesControlPage()`, and `saveSpeciesControlLists()`.
- Consumes Task 1 types and `parseBirdnetConfig()`/`resolveSettingsPath()` from `settings-config.server.ts` without modifying Settings files.

- [ ] **Step 1: Write fixture tests** using temporary model/list/config directories. Cover scientific-only and `Scientific_Common` lines, strict installed-label/localization intersection, configured model selection, unknown-line preservation, duplicate handling, absent list files, and history aggregates from a temporary SQLite database.

```ts
test("catalog contains only labels the active classifier can emit", async () => {
  const page = await loadSpeciesControlPage(fixture.dependencies);
  assert.deepEqual(page.rows.map(({ sciName }) => sciName), ["Canis latrans", "Sciurus carolinensis"]);
  assert.deepEqual(page.unresolved.excluded, ["Stale species_Old name"]);
});
```

- [ ] **Step 2: Run the focused server test** and confirm RED.
- [ ] **Step 3: Implement model/config resolution and parsing.** Read `${MODEL}_Labels.txt`, strip legacy suffixes only when present, map through `l18n/labels_en.json`, and calculate revision with SHA-256 over list name, existence, and exact content.
- [ ] **Step 4: Implement history aggregation.** Query grouped scientific/common name, count, maximum confidence, last recorded timestamp, and distinct clip identities through an injected/read-only `DatabaseSync`; close only handles opened by this module.
- [ ] **Step 5: Re-run the focused test** and confirm GREEN.
- [ ] **Step 6: Commit only Task 2 files** with `feat: load species control state`.

---

### Task 3: Make staged saves revision-safe and atomic

**Files:**
- Modify: `web-ui/src/lib/species-control.server.ts`
- Modify: `web-ui/src/lib/species-control.server.test.ts`

**Interfaces:**
- `saveSpeciesControlLists(input, dependencies?) -> Promise<{revision: string}>` consumes the normalized Task 1 payload.
- Unknown lines are removed only by exact list/raw-token pairs already present in the current revision.

- [ ] **Step 1: Add failing persistence tests** for canonical common-name serialization, sorting, unknown preservation/removal, stale revision rejection, file-mode preservation, concurrent-save serialization, second-rename failure rollback, and cleanup of temporary/backup files.
- [ ] **Step 2: Run the focused test** and confirm RED on unimplemented saves.
- [ ] **Step 3: Implement a process-local promise mutex**, re-read and compare revision inside the lock, validate every known entry against the current catalog, create sibling temporary files, rotate originals to unique backups, install all three replacements, rollback installed targets on any error, and remove leftovers in `finally`.
- [ ] **Step 4: Re-run the focused test** and confirm GREEN with no temporary files left in fixtures.
- [ ] **Step 5: Commit Task 3 paths** with `feat: persist species policies safely`.

---

### Task 4: Add geographic range preview

**Files:**
- Modify: `scripts/species.py`
- Create: `tests/test_species.py`
- Modify: `web-ui/src/lib/species-control.server.ts`
- Modify: `web-ui/src/lib/species-control.server.test.ts`

**Interfaces:**
- Python adds `--json` while preserving the existing human-readable CLI.
- Server produces `previewSpeciesRange(dependencies?) -> Promise<SpeciesRangePreview>` with an injected fixed runner for tests.

- [ ] **Step 1: Add failing Python output coverage** for a new pure `format_species_json(model, week, threshold, species)` helper; assert its parsed JSON contains `model`, `week`, `threshold`, and `{sciName, comName, probability}` entries in probability order.
- [ ] **Step 2: Add failing Node tests** for exact executable/arguments, JSON parsing, cache-key separation, timeout, malformed output, unsupported model, and safe unavailable messages.
- [ ] **Step 3: Run focused Python and Node tests** and confirm RED.
- [ ] **Step 4: Implement `--json`** without changing normal output. Use the configured threshold when none is supplied and never write settings or list files.
- [ ] **Step 5: Implement the fixed server runner** with `python3`, the repository-owned script path, `--json`, and `--threshold`; use `execFile`/`spawn` with `shell: false`, a bounded timeout, and an in-memory cache keyed by model/coordinates/week/range version/threshold.
- [ ] **Step 6: Re-run focused tests** and confirm GREEN.
- [ ] **Step 7: Commit Task 4 files** with `feat: preview geographic species range`.

---

### Task 5: Add safe species-history management

**Files:**
- Modify: `web-ui/src/lib/species-control.server.ts`
- Modify: `web-ui/src/lib/species-control.server.test.ts`

**Interfaces:**
- Produces `previewSpeciesHistoryDeletion(sciName, dependencies?)` and `deleteSpeciesHistory({sciName, expectedRows}, dependencies?)`.
- Reuses `resolveDetectionClipPath()` and the same database/filesystem safety rules as detection deletion.

- [ ] **Step 1: Add failing temporary-database/filesystem tests** covering exact preview counts, invalid/unknown names, transaction rollback, deletion by scientific name, shared clip preservation, audio plus `.png` deletion, missing files, paths outside the extracted root, changed row count between preview/confirm, and review-row cleanup where the reviews table exists.
- [ ] **Step 2: Run the focused test** and confirm RED.
- [ ] **Step 3: Implement preview** from a read-only query that returns rows and unique clip identities but performs no mutation.
- [ ] **Step 4: Implement confirmed deletion** with `BEGIN IMMEDIATE`, recheck `expectedRows`, select targets, delete detection and matching review identities, commit, then remove only unreferenced resolved assets beneath the configured extracted root and return deleted/missing/failed counts.
- [ ] **Step 5: Re-run the focused test** and confirm GREEN.
- [ ] **Step 6: Commit Task 5 paths** with `feat: manage species detection history`.

---

### Task 6: Expose typed TanStack operations

**Files:**
- Create: `web-ui/src/lib/species-control.ts`
- Create: `web-ui/src/lib/species-control-functions.test.ts`

**Interfaces:**
- Produces `getSpeciesControlPage`, `saveSpeciesControl`, `getSpeciesRangePreview`, `getSpeciesHistoryDeletePreview`, and `deleteSpeciesHistoryFn`.
- Each POST uses the exact Task 1 Zod validator and calls one Task 2-5 operation.

- [ ] **Step 1: Load TanStack server-function guidance** with `npx @tanstack/intent@latest load @tanstack/start-client-core#start-core/server-functions` from `web-ui/`.
- [ ] **Step 2: Write a failing named-contract test** importing all five operations and asserting they are functions.
- [ ] **Step 3: Run the focused test** and confirm RED.
- [ ] **Step 4: Implement one GET, one preview GET, and three exact POST functions.** Do not expose generic operation names or filesystem inputs.
- [ ] **Step 5: Run the function test and typecheck** and confirm GREEN.
- [ ] **Step 6: Commit Task 6 files** with `feat: expose species control operations`.

---

### Task 7: Build the staged species-control workspace

**Files:**
- Create: `web-ui/src/components/species-control/species-control-page.tsx`
- Create: `web-ui/src/components/species-control/species-control-summary.tsx`
- Create: `web-ui/src/components/species-control/species-control-table.tsx`
- Create: `web-ui/src/components/species-control/species-control-dialogs.tsx`
- Create: `web-ui/src/components/species-control/species-control-tools.tsx`
- Create: `web-ui/src/components/species-control/species-control-page.test.tsx`

**Interfaces:**
- `SpeciesControlPage` consumes initial `SpeciesControlPageData` plus typed async adapters for save, preview, history preview, and history deletion.
- Child components receive explicit data/callback props and never import server functions.

- [ ] **Step 1: Read and apply `frontend-design` guidance** before writing components; keep the approved field-guide visual direction and existing tokens.
- [ ] **Step 2: Write failing rendered-contract tests** asserting the page title, six summaries, scope explanation, search and policy filters, Custom/Policy/Effective columns, import/export/reset tools, pending bar, and history action are present with labels and native controls.
- [ ] **Step 3: Run the focused component test** and confirm RED.
- [ ] **Step 4: Implement staged state** as Custom/Excluded/Whitelisted sets initialized from server rows. Derive pending changes and effective outcomes with Task 1 helpers; never mutate loader data.
- [ ] **Step 5: Implement Fuse search, filters, 50-row pagination, selection, row policies, Custom membership, and bulk actions.** Render only one page while applying bulk actions to the selected/filtered IDs the interface names.
- [ ] **Step 6: Implement summaries, geographic preview, and effective-state explanations.** Preview results merge into staged state client-side.
- [ ] **Step 7: Implement review/save and discard dialogs.** Save sends the original revision plus complete known-list membership and explicit unresolved removals; successful save replaces the baseline and clears dirty state, while errors preserve edits.
- [ ] **Step 8: Implement list tools.** Browser-side text/JSON import stages validated entries; downloads use Blob/object URLs; reset actions stage empty lists after confirmation; unresolved rows support explicit removal.
- [ ] **Step 9: Implement history dialogs** with separate preview and confirm phases and exact counts; invalidate/reload after success.
- [ ] **Step 10: Run focused component tests and typecheck** and confirm GREEN.
- [ ] **Step 11: Commit Task 7 files** with `feat: build species control workspace`.

---

### Task 8: Add route and navigation

**Files:**
- Create: `web-ui/src/routes/species-control.tsx`
- Create: `web-ui/src/routes/species-control-route.test.ts`
- Modify: `web-ui/src/components/Header.tsx`
- Regenerate: `web-ui/src/routeTree.gen.ts`

**Interfaces:**
- Route loader calls `getSpeciesControlPage`; component adapts `useServerFn` operations and invalidates after committed saves/deletions.
- Failure state explains whether the configured model/catalog or list directory is unavailable without revealing paths.

- [ ] **Step 1: Load TanStack route/data/navigation guidance** for file routes, loaders, and links using the commands required by `web-ui/AGENTS.md`.
- [ ] **Step 2: Write a failing route-source contract test** for `/species-control`, loader, page title, server adapters, invalidation, error copy, and the `Control` navigation link immediately after Species.
- [ ] **Step 3: Run the focused route test** and confirm RED.
- [ ] **Step 4: Implement the route and error component**, then add the header link without touching dirty Settings files.
- [ ] **Step 5: Run `npm run generate-routes`, focused tests, and typecheck** and confirm GREEN.
- [ ] **Step 6: Commit Task 8 files** with `feat: route species controls`.

---

### Task 9: Verify the complete workflow

**Files:**
- Modify only species-control-owned files when verification exposes a defect.

**Interfaces:**
- Produces end-to-end evidence for browser, server, list files, preview, database, and extracted assets.

- [ ] **Step 1: Run automated checks from `web-ui/`:** `npm test`, `npm run typecheck`, focused `npx biome check` over species-control files/Header/route tree, and `npm run build`.
- [ ] **Step 2: Create temporary config/model/list/database/audio fixtures** outside tracked paths; set every `BIRDNET_*` override and ensure no real Pi service or production data can be touched.
- [ ] **Step 3: Start the development server and use the in-app browser skill** to verify desktop and narrow layouts, keyboard focus, summaries/filters, staged row and bulk edits, discard, review/save, stale-save behavior, preview unavailable/success states, import/export, unresolved repair, and history confirmation.
- [ ] **Step 4: Inspect fixture files and database** to confirm canonical content, unknown preservation, exact history deletion, shared asset preservation, and no temporary/backup leftovers.
- [ ] **Step 5: Read and apply `vercel:react-best-practices`** because multiple TSX components were added, fixing only species-control-owned findings.
- [ ] **Step 6: Read and apply `superpowers:verification-before-completion`,** then repeat tests, typecheck, Biome, and build after the final fix.
- [ ] **Step 7: Audit `git status --short`** and ensure all pre-existing Settings/health changes remain untouched and uncommitted by this work.
