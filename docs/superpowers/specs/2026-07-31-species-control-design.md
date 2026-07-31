# Species Control Page Design

## Goal

Add an independent `/species-control` workspace where a station owner can understand and safely manage BirdNET-Pi's custom/include, excluded, and whitelist species files without editing text files over SSH. The page combines the useful controls found in `zach7036/BirdNET-Pi-Enhanced-Version` with Birdbook Pi's existing catalog, detection history, review, and safe-deletion patterns.

## Product direction

Use one consolidated workspace rather than separate Included, Excluded, Whitelisted, and Species Management pages. The full installed-model catalog is the organizing surface. Every species row shows its identity, detection history, configured policy, custom-list membership, and effective outcome. Summary cards and filters provide focused views of each underlying list without duplicating editors.

The page follows the existing field-guide visual system and remains usable on a local Raspberry Pi over desktop and narrow browser widths. Policy edits are staged in the browser and committed through one explicit **Review and save changes** action. Destructive history removal is a separate confirmed operation and is never mixed into the staged policy save.

## Navigation and page structure

Create `/species-control` as an independent route. Add a `Control` navigation link beside `Species`, plus contextual links from the Species and Settings pages where they fit without duplicating controls.

The page contains:

1. A header explaining that these policies affect future detections, not existing history.
2. Summary cards for Custom, Excluded, Whitelisted, geographically eligible, unresolved entries, and pending edits. Clicking a card applies the matching table filter.
3. A detection-scope card that explains whether normal range filtering or Custom-only restriction is active. BirdNET's runtime rule remains authoritative: a nonempty include list activates Custom-only mode.
4. A geographic preview card that reports the current model, location, week, range-model version, threshold, result count, and preview errors without blocking the rest of the page.
5. A searchable, filterable, client-paginated catalog table.
6. A sticky pending-changes bar with discard and review/save actions.
7. An advanced list-tools section for import, export, canonicalization, and per-list reset.

## Catalog and row behavior

The catalog is the strict intersection of the installed acoustic model's label file and the English localization map. It is not sourced solely from the larger localization or BirdNET taxonomy datasets, which may contain species the active classifier cannot emit.

Each row includes:

- Common and scientific names.
- Lifetime detection count, maximum confidence, last-seen date, and available extracted-file count when the station has history.
- Geographic occurrence probability and eligibility after a preview has run.
- Policy: `Automatic`, `Always consider`, or `Never detect`.
- Custom membership.
- Effective outcome and a concise explanation.
- Links to the species detail page, filtered detections, and Review when relevant.
- A separate advanced action for deleting that species' history.

Filters cover text search, detected/never detected, Automatic, Custom, Excluded, Whitelisted, eligible/ineligible, unresolved, and pending. Checkboxes support bulk policy and Custom-membership edits across the visible filtered result set. Only the current page of rows is rendered while the complete catalog remains available to client-side Fuse search and staged state.

## Runtime semantics and conflict handling

The controls map to the existing files:

- Custom membership -> `include_species_list.txt`
- Never detect -> `exclude_species_list.txt`
- Always consider -> `whitelist_species_list.txt`

The page presents the actual runtime precedence implemented by `scripts/utils/analysis.py`:

1. When Custom contains any species, every species outside it is rejected.
2. Excluded species are rejected even if present in Custom or Whitelisted.
3. Whitelisted species bypass only the geographic occurrence filter.
4. Every species must still clear the global confidence threshold.

New edits cannot create contradictory states:

- Selecting Always consider removes Never detect.
- Selecting Never detect removes Always consider and Custom membership.
- Custom membership is disabled while Never detect is selected.
- In Custom-only mode, selecting Always consider also adds the species to Custom.

Contradictory entries that already exist on disk remain visible as issues and are not silently rewritten. The review dialog describes the canonical resolution before save. Unknown or stale lines remain visible in an unresolved section and are preserved until the owner explicitly removes them.

Adding the first Custom species activates Custom-only mode. Removing the final Custom species restores normal range filtering. Returning to normal filtering warns that it empties the Custom list and offers an export first; there is no hidden second source of truth for inactive Custom selections.

## Persistence and concurrency

Resolve the species-list directory from `BIRDNET_SPECIES_LIST_DIR` for tests and development, falling back to `~/BirdNET-Pi`. Resolve model files through the existing `BIRDNET_MODEL_DIR` behavior.

Accept both legacy scientific-only lines and canonical `Scientific name_Common name` lines. New known entries are serialized canonically, sorted by common name, and deduplicated by scientific name. Blank lines are ignored. Unknown lines are retained verbatim unless explicitly removed.

The initial read returns a revision derived from the three files. Save requires that revision; if any file changed after the page loaded, the server rejects the save and asks the client to reload rather than overwriting manual or concurrent edits.

Save validates the complete staged payload against the active installed catalog, writes sibling temporary files, preserves original file modes where present, and replaces the three list files as one guarded operation. On a partial failure it restores backups and reports a safe error without paths or file contents. A process-local mutex prevents overlapping saves. No service restart is required because the analysis process rereads the lists for every recording.

## Geographic preview

Preview is opt-in rather than part of initial page load. A fixed server runner invokes the existing species-range tooling with the current model, station coordinates, current ISO week, range-model version, and configured frequency threshold. It does not accept executable names, paths, or shell fragments from the client.

Return structured scientific name, common name, and probability entries. Cache successful results by model, coordinates, week, data-model version, and threshold. A timeout, missing model, unsupported classifier, or unavailable Python dependency produces a concise unavailable state while all list editing remains functional.

The client combines preview results with staged policies to calculate the effective outcome immediately without rerunning the model after every edit.

## Import, export, and repair

List tools support:

- Downloading each legacy-compatible text file.
- Downloading one JSON snapshot with revision and all three lists.
- Importing text or JSON into staged state without writing immediately.
- Reviewing invalid, duplicate, stale, and contradictory entries.
- Canonicalizing known entries.
- Resetting one list or all lists through a confirmation dialog.

Imports have size and line-count limits, never accept paths, and must pass the same catalog and conflict validation as interactive edits.

## Historical management

Detected-species aggregates are read from SQLite and joined to the catalog by scientific name. History controls do not change future detection policy.

`Clear species history` first returns a preview containing the exact number of detection rows and unreferenced audio/spectrogram files. Confirmation names the species and states that the operation cannot be undone. The server rechecks the target after confirmation, deletes matching database rows through a write-capable connection, resolves every asset beneath `BIRDNET_EXTRACTED_DIR`, preserves assets still referenced by another row, and reports deleted, missing, and failed file counts. The operation follows the existing detection deletion safety helpers and never accepts a filesystem path from the browser.

The enhanced fork's `confirmed_species_list.txt` is intentionally not added. Birdbook Pi's `reviews` table already records confirmation and recategorization per detection without introducing a competing confirmation system.

## Server and component boundaries

- `species-control-data.ts`: client-safe types, search/filter normalization, effective-outcome and conflict helpers.
- `species-control.server.ts`: model catalog loading, list parsing, revisioning, atomic persistence, aggregates, preview orchestration, and history deletion.
- `species-control.ts`: typed TanStack server functions with exact validators.
- `components/species-control/*`: summary, scope, preview, catalog table, pending bar, review dialog, list tools, and history confirmation.
- `routes/species-control.tsx`: loader, server-function adapters, invalidation, page metadata, and route-level failure state.

The server interfaces remain independent: catalog/list loading, range preview, policy save, import parsing, and history deletion can be tested without rendering React. The page never exposes arbitrary configuration keys, commands, or file paths.

## Error handling and accessibility

Loading failures distinguish an unavailable model catalog from unavailable optional preview/history data. A save failure preserves staged edits. Stale revisions offer reload rather than automatic overwrite. Partial filesystem rollback failures are logged server-side and presented as a concise action-required message.

All controls use native buttons, checkboxes, radios, labels, and dialogs; table policy state is conveyed by text and icons in addition to color. Bulk actions announce affected counts. The pending bar and save results use live regions. Dialog focus is trapped and restored. Keyboard users can search, select rows, change policies, review, save, export, and cancel without pointer input.

## Verification

Automated coverage includes:

- Legacy and canonical list parsing, unknown-entry preservation, sorting, and deduplication.
- Actual runtime precedence and every conflict transition.
- Revision mismatch, process-local save serialization, atomic replacement, rollback, and mode preservation.
- Installed-model catalog intersection and alternate model directories.
- Detection aggregates and available-file counts.
- Fixed preview command selection, parsing, cache keys, timeout, and unavailable states.
- Import limits and validation.
- Species-history preview and safe deletion, including shared/missing/out-of-root assets.
- Server-function contracts and rendered page structure.
- Search, filters, bulk edits, staged discard/save, dialogs, and responsive table behavior.

Run the full test suite, typecheck, focused Biome checks, production build, and browser verification at desktop and narrow widths using temporary list/config/database/audio fixtures and skipped real system actions.

## Out of scope

- Training a new acoustic classifier.
- Adding taxonomy groups that cannot be derived reliably from the installed model assets.
- Retaining raw unclassified audio.
- Replacing the existing Review workflow.
- Silently migrating or deleting unknown manual list entries.
