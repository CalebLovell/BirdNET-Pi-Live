# Review Page Design

## Purpose

Add a focused `/review` page where a user can listen to questionable BirdNET detections and directly correct the source data. The page is intentionally simple: it does not record review history, introduce review statuses, or add database tables. A completed review either confirms the current classification at 100% confidence, changes the classification at 100% confidence, or deletes the detection.

## Goals

- Surface rare-species recordings and the lowest-confidence recordings in separate queues.
- Let the user compare the local clip with the species' public eBird page.
- Require explicit confirmation before every database or filesystem mutation.
- Apply corrections directly to the existing `detections` table.
- Keep the two queues synchronized after every mutation.
- Reuse the application's existing audio, species-link, path-safety, and deletion patterns.

## Non-goals

- Review history, audit logs, notes, reviewer identity, or persisted review status.
- New database tables or columns.
- Automatically downloading or embedding third-party reference audio.
- Grouping detections into visits or applying one decision to multiple rows.
- Automatically excluding a species from future BirdNET analysis.
- Undo after a confirmed mutation. Confirmation is the safeguard for this version.

## Navigation and Page Structure

Add a `Review` link to the main header navigation and a file route at `/review`.

The page contains:

1. A compact page header explaining that confirmed actions directly modify detections.
2. Two tabs: `Rare species` and `Low confidence`. Each tab displays the number of currently available candidates.
3. One focused review card at a time.
4. A queue-position indicator and a `Load more` action after each batch of 20.
5. Empty, loading, mutation-error, and missing-audio states.

The focused card displays:

- Common and scientific names.
- Detection date and time.
- Current confidence.
- The reason it appears in the active queue.
- Lifetime species count in the rare-species queue.
- The local extracted recording player.
- A link to the species' eBird page, using the existing eBird code mapping. The link opens in a new tab so the user can select `Listen` there and return to the review.
- `Correct`, `Recategorize`, `Delete`, and `Skip` actions.

## Queue Definitions

Both queues are derived from the current `detections` table and return at most 20 candidates per page.

A detection is review-eligible only while `Confidence` is null or less than `1.0`. In this deliberately simplified model, `1.0` is both the effective confidence and the marker that a human has accepted or recategorized the recording. This prevents a completed recording from returning without adding review metadata.

### Rare species

1. Group review-eligible detections by scientific and common name while calculating lifetime species counts from all detections.
2. Rank species by ascending lifetime detection count, then common name for deterministic ties.
3. Select one candidate per species: its lowest-confidence detection, breaking ties by newest date and time.
4. Return the first 20 species candidates.

This prevents a species with several recordings from crowding out other rare species while presenting the most questionable clip for each rare bird first.

### Low confidence

1. Rank review-eligible individual detections by ascending confidence.
2. Treat a null confidence as lower than any numeric confidence.
3. Break confidence ties by newest date and time.
4. Return the first 20 candidates.

The low-confidence queue may contain several recordings of the same species.

### Cross-queue synchronization

A recording may initially appear in both queues. Correcting, recategorizing, or deleting it invalidates and reloads both queue queries:

- Correct and Recategorize set confidence to `1.0`, removing the recording from both review queues.
- Recategorize also changes which species group and lifetime count include the recording.
- Delete removes the recording entirely.

The refreshed rare-species queue may surface another unreviewed recording for the same rare species. This is expected because review state is represented only by each row's confidence.

Skip only advances the current browser session. It does not write to the database, and the candidate may return after a route reload.

## Stable Detection Identity

All mutations target SQLite `rowid`. The server reloads the complete detection row by `rowid` immediately before making a change. A missing row produces a not-found result instead of applying a mutation to a stale queue item.

No user-controlled filename or filesystem path is accepted by a mutation endpoint. Paths are derived exclusively from the database row and a validated species choice.

## Supported Species Catalog

The recategorization picker reads the label file for the repository's configured BirdNET model. Labels are parsed into scientific/common-name pairs on the server and returned as a searchable catalog.

The submitted replacement must exactly match one entry in that catalog. The server does not trust a common or scientific name supplied independently by the browser.

## Actions

### Correct

The confirmation dialog states that the detection will be marked as human-confirmed at 100% confidence. On approval, the server runs:

```sql
UPDATE detections SET Confidence = 1.0 WHERE rowid = ?
```

No audio file is changed.

### Recategorize

The user opens a searchable picker containing every supported BirdNET species. After selecting a replacement, the confirmation dialog shows the old and new classifications and explains that the recording will be marked at 100% confidence.

On approval, the server:

1. Reloads the row and validates the selected species against the active label catalog.
2. Resolves the current extracted audio path with the existing path-safety helper.
3. Derives the replacement filename and destination directory using BirdNET-Pi's existing classification filename conventions.
4. Rejects an unsafe path or an occupied destination.
5. Moves the audio file and its matching spectrogram, when present.
6. Updates `Sci_Name`, `Com_Name`, `File_Name`, and `Confidence = 1.0` for the target `rowid` in a database transaction.

If the database update fails after the files move, the server attempts to move the files back before returning an error. If rollback is incomplete, the response clearly reports which filesystem step requires manual attention. No success response is returned unless the database and required audio move agree.

### Delete

The confirmation dialog identifies the species and recording time and warns that the action cannot be undone.

On approval, the server reuses the existing detection-deletion workflow:

1. Reload the target by `rowid`.
2. Delete the database row transactionally.
3. Remove the extracted audio and related assets only when no remaining database row references them.
4. Report partial filesystem cleanup separately from database success.

### Skip

Skip requires no confirmation and makes no persistent change. It removes the card from the active in-memory batch and advances to the next candidate.

## Confirmation Dialogs

Correct, Recategorize, and Delete each use a dedicated confirmation state. Closing or cancelling a dialog performs no server call. While a mutation is pending, its confirmation button is disabled to prevent duplicate submissions.

After success, the page advances to the next candidate and refreshes both queue counts. After failure, the current card remains active and displays a concise error with a retry path.

## Missing Audio

A candidate whose database row exists but whose extracted recording is missing remains visible with an `Audio unavailable` state.

- Correct and Recategorize are disabled because the user cannot verify the sound.
- Delete remains available to remove the orphaned database entry.
- Skip remains available.

## Architecture

Keep the implementation divided into focused units:

- `web-ui/src/routes/review.tsx`: route, tab/search state, loader wiring, and page composition.
- `web-ui/src/components/review/`: focused card, queue controls, confirmation dialog, and species picker.
- `web-ui/src/lib/review.ts`: server-only queries, label catalog loading, and mutations.
- `web-ui/src/lib/review-data.ts`: pure queue-ranking and response-shaping helpers.

The route uses TanStack Router search parameters for the active tab and page offset so navigation remains predictable. Mutations use TanStack Start server functions, validate all input server-side, and invalidate the router on success.

Existing utilities remain the source of truth for:

- Local audio URLs and safe extracted-file resolution.
- eBird species URLs.
- Buttons, badges, dialogs, and visual tokens.
- Detection deletion and unreferenced-file cleanup.

## Error Handling and Concurrency

- Invalid row IDs and unsupported species return validation errors without mutation.
- A detection changed or deleted after the queue loaded returns a stale/not-found response and triggers a queue refresh.
- SQLite mutations use transactions.
- Filesystem destinations are checked before moving anything.
- Mutation buttons remain disabled while a request is pending.
- Queue loading failures show a retry action without discarding the active tab.
- An unavailable eBird mapping falls back to the existing species-search URL behavior.

## Testing

### Pure data tests

- Rare species are ordered by ascending lifetime count.
- Only one candidate is selected per rare species.
- The lowest-confidence candidate is selected for each rare species.
- Low-confidence candidates are ordered correctly, including null confidence.
- Tie-breaking is deterministic.

### Mutation integration tests

Use a temporary SQLite database and temporary extracted-audio directory to verify:

- Correct changes only confidence to `1.0`.
- Recategorize changes both species names, filename, and confidence, and moves associated files.
- Recategorize rejects unsupported species and unsafe or occupied destinations.
- Recategorize restores files when the database update fails.
- Delete removes the row and unreferenced assets.
- Delete preserves assets still referenced by another row.
- Missing and stale row IDs do not mutate data.

### UI behavior tests

- No mutation call occurs before confirmation.
- Cancelling leaves the candidate unchanged.
- Skip advances without a server mutation.
- Successful actions refresh both queues and advance.
- Failed actions retain the current card and show an actionable error.
- Missing audio disables Correct and Recategorize but permits Delete and Skip.

### Completion checks

Run the complete test suite, TypeScript typecheck, Biome check, and production build.

## Acceptance Criteria

- `/review` is reachable from the main navigation.
- The page provides separate Rare species and Low confidence queues with 20 candidates per batch.
- Recordings with `Confidence = 1.0` do not appear in either queue.
- Rare species contribute no more than one recording per batch.
- Each card plays the local recording and links to the species' eBird page.
- Correct sets confidence to 100% only after confirmation.
- Recategorize supports any species in the active BirdNET model, updates the database and file paths consistently, and sets confidence to 100% only after confirmation.
- Delete removes the selected detection and safely cleans up its assets only after confirmation.
- Skip performs no persistent mutation.
- A mutation made from either queue is reflected in both queues immediately.
- No database table or column is added.
