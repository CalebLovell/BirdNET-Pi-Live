# Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one card-based `/settings` page that safely edits BirdNET-Pi station, detection, privacy, audio, recording, storage, and Review rarity settings with independent per-card saves.

**Architecture:** Keep `birdnet.conf` as the source of truth. Pure Zod schemas define browser/server contracts; server-only modules preserve and atomically update allowlisted assignments, then run fixed system actions. TanStack server functions expose typed reads and per-card writes, while Review receives its threshold from the same configuration layer.

**Tech Stack:** TanStack Start, React 19, TypeScript 6, Zod 4, Node filesystem/process APIs, Node SQLite, Tailwind CSS 4, Node test runner.

## Global Constraints

- One `/settings` route; no tabs or secondary settings routes.
- Card order: Station, Detection, Privacy, Audio input, Recording, Storage, Review queue.
- Every card saves independently and reports its own pending, error, saved, restart, or partial-success state.
- `BIRDNET_CONF` overrides `/etc/birdnet/birdnet.conf`.
- Preserve comments, ordering, unknown assignments, and excluded integration settings.
- Never accept client-created configuration keys, paths, service names, executables, or command arguments.
- Never return raw configuration text, command output, filesystem paths, or RTSP credentials in errors.
- `REVIEW_RARE_SPECIES_MAX` is a strict lifetime-count cutoff, defaults to `10`, and must not reuse the days-based `RARE_SPECIES_THRESHOLD`.
- No BirdWeather, notifications, public URL, diagnostics, display preferences, authentication redesign, device discovery, or test recording.
- Add no dependencies. Do not modify the already-dirty `web-ui/package.json` or `web-ui/src/styles.css`.
- Preserve unrelated working-tree changes and stage only task-owned paths.
- Before editing server functions, load the TanStack server-functions guidance required by `web-ui/AGENTS.md`.

## File Map

- `web-ui/src/lib/settings-data.ts`: shared types, defaults, Zod schemas, normalization, and model metadata.
- `web-ui/src/lib/settings-config.server.ts`: configuration parsing, typed reads, preservation, and atomic writes.
- `web-ui/src/lib/settings-system.server.ts`: fixed service and timezone actions.
- `web-ui/src/lib/settings.server.ts`: load/save orchestration and safe public results.
- `web-ui/src/lib/settings.ts`: one TanStack GET and seven POST server functions.
- `web-ui/src/lib/settings-functions.test.ts`: named server-function contract test.
- Matching `*.test.ts` files for each settings library module.
- `web-ui/src/components/settings/settings-card.tsx`: common card frame and accessible fields.
- `web-ui/src/components/settings/settings-cards.tsx`: seven independently controlled forms.
- `web-ui/src/components/settings/settings-page.tsx`: masthead and card composition.
- `web-ui/src/components/settings/settings-page.test.tsx`: rendered structure assertions.
- `web-ui/src/routes/settings.tsx`: loader, actions, error component, and route rendering.
- `web-ui/src/components/Header.tsx`: Settings navigation link.
- `web-ui/src/lib/review.server.ts`, its tests, `review.ts`, `review-data.ts`, and `routes/review.tsx`: configuration-driven rarity.
- `scripts/install_config.sh`: fresh-install Review default.
- `web-ui/src/routeTree.gen.ts`: generated route registration.

---

### Task 1: Define and test shared settings contracts

**Files:**
- Create: `web-ui/src/lib/settings-data.ts`
- Create: `web-ui/src/lib/settings-data.test.ts`

**Interfaces:**
- Produces `SettingsCardKind`, seven payload types, `SettingsPageData`, `SettingsSaveResult<T>`, `DEFAULT_REVIEW_RARE_SPECIES_MAX`, `SUPPORTED_MODELS`, individual schemas, and `parseSettingsCard(kind, input)`.
- Uses camelCase in TypeScript; shell-key mapping belongs only to the server layer.

- [ ] **Step 1: Write the failing validation tests**

Use `node:test` and `node:assert/strict`. Include this representative behavior:

```ts
test("accepts inclusive detector boundaries", () => {
  assert.deepEqual(parseSettingsCard("detection", {
    model: "BirdNET_GLOBAL_6K_V2.4_Model_FP16",
    dataModelVersion: 2,
    speciesFrequencyThreshold: 0.0005,
    confidence: 0.99,
    sensitivity: 0.5,
    overlap: 2.9,
  }).overlap, 2.9);
});

test("rejects extraction longer than recording", () => {
  assert.throws(() => parseSettingsCard("recording", {
    recordingLength: 10,
    extractionLength: 11,
    audioFormat: "mp3",
  }), /Extraction length/);
});

test("normalizes RTSP lines and validates the live index", () => {
  const value = parseSettingsCard("audio", {
    mode: "rtsp",
    recordingDevice: "default",
    channels: 2,
    rtspStreams: "rtsp://one/live\n\nrtsps://two/live",
    livestreamIndex: 1,
  });
  assert.deepEqual(value.rtspStreams, ["rtsp://one/live", "rtsps://two/live"]);
  assert.throws(() => parseSettingsCard("audio", { ...value, livestreamIndex: 2 }));
});

test("defaults Review rarity to ten and rejects zero", () => {
  assert.equal(DEFAULT_REVIEW_RARE_SPECIES_MAX, 10);
  assert.deepEqual(parseSettingsCard("review", {}), { rareSpeciesMax: 10 });
  assert.throws(() => parseSettingsCard("review", { rareSpeciesMax: 0 }));
});
```

Also cover coordinates, site-name length, supported timezone membership, privacy `0..3`, microphone-device requirement, channels `1..32`, recording `3..60`, audio formats `mp3|wav|flac|ogg`, disk threshold `20..99`, non-negative file cap, control characters, and invalid enums.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/lib/settings-data.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the schemas and types**

Define:

```ts
export type SettingsCardKind =
  | "station" | "detection" | "privacy" | "audio"
  | "recording" | "storage" | "review";

export const DEFAULT_REVIEW_RARE_SPECIES_MAX = 10;

export type SettingsSaveResult<T> = {
  status: "saved" | "saved-restart-skipped" | "saved-action-failed";
  values: T;
  message: string;
};
```

Use Zod `.superRefine` for recording/extraction and RTSP/index relationships. `parseSettingsCard` switches on the server-selected kind.

- [ ] **Step 4: Run GREEN**

Run: `npm test -- src/lib/settings-data.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 1 paths only**

```powershell
git add -- web-ui/src/lib/settings-data.ts web-ui/src/lib/settings-data.test.ts
git commit -m "feat: define settings contracts"
```

---

### Task 2: Preserve and atomically update `birdnet.conf`

**Files:**
- Create: `web-ui/src/lib/settings-config.server.ts`
- Create: `web-ui/src/lib/settings-config.server.test.ts`

**Interfaces:**
- Consumes shared payload types and defaults.
- Produces `resolveSettingsPath()`, `parseBirdnetConfig(text)`, `readSettingsPageValues(path?)`, `writeSettingsCard(kind, values, path?)`, and `readReviewRareSpeciesMax(path?)`.

- [ ] **Step 1: Write failing parser and filesystem tests**

Use real temporary files. Assert updating Station changes only `SITE_NAME`, `LATITUDE`, and `LONGITUDE`; preserves comments, blank lines, ordering, `BIRDWEATHER_ID`, and RTSP credentials; escapes quotes; rejects embedded newlines; preserves mode; and leaves no temporary file. Assert two Review saves create exactly one `REVIEW_RARE_SPECIES_MAX` line.

```ts
test("appends the Review setting once", async () => {
  const file = await fixtureConfig("CONFIDENCE=0.7\n");
  await writeSettingsCard("review", { rareSpeciesMax: 12 }, file);
  await writeSettingsCard("review", { rareSpeciesMax: 14 }, file);
  const text = await readFile(file, "utf8");
  assert.equal(text.match(/^REVIEW_RARE_SPECIES_MAX=/gm)?.length, 1);
  assert.match(text, /REVIEW_RARE_SPECIES_MAX=14/);
});
```

Also test `BIRDNET_CONF` precedence, `/etc` fallback, quoted/unquoted/blank values, comma-to-array RTSP conversion, and missing/invalid Review fallback to `10`.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/lib/settings-config.server.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement preservation and atomic replacement**

Start with `import "@tanstack/react-start/server-only";`. Use a constant per-card map of allowed keys and serializers. Read immediately before each write, replace only anchored assignments, and append only a missing Review key. Write a sibling `${path}.tmp-${process.pid}-${randomUUID()}`, apply the source mode, rename it over the source, and remove leftovers in `finally`.

`readReviewRareSpeciesMax` catches only missing-file/missing-key/invalid-value cases; other I/O errors propagate.

- [ ] **Step 4: Run GREEN**

Run: `npm test -- src/lib/settings-config.server.test.ts`

Expected: PASS on temporary Windows paths without touching `/etc`.

- [ ] **Step 5: Commit Task 2 paths only**

```powershell
git add -- web-ui/src/lib/settings-config.server.ts web-ui/src/lib/settings-config.server.test.ts
git commit -m "feat: persist BirdNET settings safely"
```

---

### Task 3: Orchestrate fixed system actions and typed saves

**Files:**
- Create: `web-ui/src/lib/settings-system.server.ts`
- Create: `web-ui/src/lib/settings-system.server.test.ts`
- Create: `web-ui/src/lib/settings.server.ts`
- Create: `web-ui/src/lib/settings.server.test.ts`

**Interfaces:**
- Produces `runCardSystemActions(kind, context, runner?)`, `loadSettingsPageData()`, seven `save*Settings()` functions, and a re-exported `readReviewRareSpeciesMax()`.
- Command runner: `(executable: string, args: readonly string[], stdin?: string) => Promise<void>`.

- [ ] **Step 1: Write failing command-selection tests**

Use an injected recording runner. Assert exact executable/argument arrays:

```ts
test("audio restarts only its fixed services", async () => {
  const calls: unknown[] = [];
  await runCardSystemActions("audio", {}, async (executable, args, stdin) => {
    calls.push({ executable, args, stdin });
  });
  assert.deepEqual(calls, [{
    executable: "sudo",
    args: ["systemctl", "restart", "birdnet_recording.service",
      "livestream.service", "spectrogram_viewer.service"],
    stdin: undefined,
  }]);
});
```

Cover Station/Detection/Privacy restarting analysis; Recording restarting recording, analysis, and spectrogram; Storage/Review running nothing; changed timezone running `sudo timedatectl set-timezone <zone>` and optional `sudo tee /etc/timezone`; unchanged timezone skipping timezone commands; and `BIRDNET_SKIP_SYSTEM_ACTIONS=1` skipping everything.

- [ ] **Step 2: Write failing save-orchestration tests**

With a real fixture config, assert invalid data causes neither write nor command; a successful write happens before actions; command failure leaves the saved value and returns `saved-action-failed`; skipped actions return `saved-restart-skipped`; and public errors contain neither fixture paths nor RTSP URLs.

- [ ] **Step 3: Run RED**

Run: `npm test -- src/lib/settings-system.server.test.ts src/lib/settings.server.test.ts`

Expected: FAIL because both modules are absent.

- [ ] **Step 4: Implement fixed actions without a shell**

Use `execFile` or `spawn` with `shell: false`. Use this constant map:

```ts
const SERVICES = {
  station: ["birdnet_analysis.service"],
  detection: ["birdnet_analysis.service"],
  privacy: ["birdnet_analysis.service"],
  audio: ["birdnet_recording.service", "livestream.service", "spectrogram_viewer.service"],
  recording: ["birdnet_recording.service", "birdnet_analysis.service", "spectrogram_viewer.service"],
  storage: [],
  review: [],
} as const;
```

Pass the validated timezone as one argument. Pass timezone-file content through stdin to `tee`, never through a shell string.

- [ ] **Step 5: Implement loading and seven save functions**

`loadSettingsPageData` combines parsed values with `Intl.supportedValuesOf("timeZone")`, the current timezone, and installed supported model files under `BIRDNET_MODEL_DIR` or `../model`. Every save validates, writes, runs its mapped actions, and returns a fixed safe message/status.

- [ ] **Step 6: Run GREEN and regression tests**

Run: `npm test -- src/lib/settings-system.server.test.ts src/lib/settings.server.test.ts`

Run: `npm test`

Expected: all PASS.

- [ ] **Step 7: Commit Task 3 paths only**

```powershell
git add -- web-ui/src/lib/settings-system.server.ts web-ui/src/lib/settings-system.server.test.ts web-ui/src/lib/settings.server.ts web-ui/src/lib/settings.server.test.ts
git commit -m "feat: apply settings system actions"
```

---

### Task 4: Make Review rarity configuration-driven

**Files:**
- Modify: `web-ui/src/lib/review.server.test.ts`
- Modify: `web-ui/src/lib/review.server.ts`
- Modify: `web-ui/src/lib/review.ts`
- Modify: `web-ui/src/lib/review-data.ts`
- Modify: `web-ui/src/routes/review.tsx`
- Modify: `scripts/install_config.sh`

**Interfaces:**
- Changes `loadReviewPage(database, extractedRoot, search, rareSpeciesMax): ReviewPage`.
- Adds `ReviewPage.rareSpeciesMax`.
- Consumes `readReviewRareSpeciesMax()` and `DEFAULT_REVIEW_RARE_SPECIES_MAX`.

- [ ] **Step 1: Change Review tests first**

Update existing calls to pass `10`, then add:

```ts
test("configured rarity changes the queue at a strict boundary", async () => {
  const database = bandedFixture();
  const root = await mkdtemp(path.join(tmpdir(), "birdnet-review-configured-"));
  const underThree = loadReviewPage(database, root, { limit: 50 }, 3);
  assert.deepEqual(
    [...new Set(underThree.candidates.map((row) => row.comName))],
    ["Cedar Waxwing", "Common Loon"],
  );
  assert.equal(underThree.rareSpeciesMax, 3);
  assert.equal(loadReviewPage(database, root, { limit: 50 }, 11).speciesTotal, 4);
  database.close();
});
```

- [ ] **Step 2: Run RED**

Run: `npm test -- src/lib/review.server.test.ts`

Expected: FAIL because the fourth argument is ignored and the result lacks the threshold.

- [ ] **Step 3: Parameterize both SQLite queries**

Change the SQL to `lifetime.lifetime_count < ?`. Bind `rareSpeciesMax` to totals `.get(...)` and as the first rows `.all(...)` argument; bind `search.limit` second. Return `rareSpeciesMax` in `ReviewPage`.

Remove `RARE_SPECIES_MAX` from `review-data.ts`. Read the setting in the `getReviewPage` handler and pass it to `loadReviewPage`. Render `page.rareSpeciesMax` in the Review masthead.

- [ ] **Step 4: Add the installation default**

Add to `scripts/install_config.sh`:

```bash
## Species with fewer lifetime detections than this appear in Review.
REVIEW_RARE_SPECIES_MAX=10
```

- [ ] **Step 5: Run GREEN and regression tests**

Run: `npm test -- src/lib/review.server.test.ts src/lib/settings-config.server.test.ts`

Run: `npm test`

Expected: all PASS.

- [ ] **Step 6: Commit Task 4 paths only**

```powershell
git add -- scripts/install_config.sh web-ui/src/lib/review.server.test.ts web-ui/src/lib/review.server.ts web-ui/src/lib/review.ts web-ui/src/lib/review-data.ts web-ui/src/routes/review.tsx
git commit -m "feat: configure Review rarity threshold"
```

---

### Task 5: Expose typed TanStack settings functions

**Files:**
- Create: `web-ui/src/lib/settings.ts`
- Create: `web-ui/src/lib/settings-functions.test.ts`

**Interfaces:**
- Produces `getSettingsPage` plus `saveStationSettingsFn`, `saveDetectionSettingsFn`, `savePrivacySettingsFn`, `saveAudioSettingsFn`, `saveRecordingSettingsFn`, `saveStorageSettingsFn`, and `saveReviewSettingsFn`.

- [ ] **Step 1: Load required TanStack guidance**

From `web-ui/`, run:

```powershell
npx @tanstack/intent@latest load @tanstack/start-client-core#start-core/server-functions
```

Apply stricter current guidance without expanding scope.

- [ ] **Step 2: Add a failing named-contract test**

Create `settings-functions.test.ts`, import all eight intended named exports, and assert each is a function:

```ts
test("exports one read and seven card-specific mutations", () => {
  for (const operation of [
    getSettingsPage,
    saveStationSettingsFn,
    saveDetectionSettingsFn,
    savePrivacySettingsFn,
    saveAudioSettingsFn,
    saveRecordingSettingsFn,
    saveStorageSettingsFn,
    saveReviewSettingsFn,
  ]) assert.equal(typeof operation, "function");
});
```

- [ ] **Step 3: Run RED**

Run: `npm test -- src/lib/settings-functions.test.ts`

Expected: FAIL because `settings.ts` is missing.

- [ ] **Step 4: Implement one GET and seven POST functions**

Each POST uses its exact Zod schema in `.validator(...)` and invokes only its matching save function. Do not expose a generic `{kind, values}` mutation.

- [ ] **Step 5: Run GREEN**

Run: `npm test -- src/lib/settings-functions.test.ts`

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit Task 5 path only**

```powershell
git add -- web-ui/src/lib/settings.ts web-ui/src/lib/settings-functions.test.ts
git commit -m "feat: expose settings server functions"
```

---

### Task 6: Build the one-page card interface

**Files:**
- Create: `web-ui/src/components/settings/settings-card.tsx`
- Create: `web-ui/src/components/settings/settings-cards.tsx`
- Create: `web-ui/src/components/settings/settings-page.tsx`
- Create: `web-ui/src/components/settings/settings-page.test.tsx`
- Create: `web-ui/src/routes/settings.tsx`
- Modify: `web-ui/src/components/Header.tsx`
- Regenerate: `web-ui/src/routeTree.gen.ts`

**Interfaces:**
- Consumes `SettingsPageData`, payload/result types, server functions, `PageHeaderCard`, `Card`, `Input`, and `Button`.
- Produces `SettingsPage({ initialData, actions })`, where `actions` is seven typed async callbacks.

- [ ] **Step 1: Write the failing rendered-page test**

Use `renderToStaticMarkup` with fixture data and no-op typed actions:

```tsx
test("renders every independently saved card in order", () => {
  const html = renderToStaticMarkup(
    <SettingsPage initialData={fixtureData} actions={actions} />,
  );
  const headings = [
    "Station", "Detection", "Privacy", "Audio input",
    "Recording", "Storage", "Review queue",
  ];
  let cursor = -1;
  for (const heading of headings) {
    const next = html.indexOf(`>${heading}<`);
    assert.ok(next > cursor, `${heading} is in page order`);
    cursor = next;
  }
  assert.equal((html.match(/type="submit"/g) ?? []).length, 7);
  assert.match(html, /Stops core services/);
  assert.match(html, /fewer than 10 lifetime detections/);
});
```

Also assert label `for` values have matching IDs, each card is a separate form, and each save button includes its card name.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/components/settings/settings-page.test.tsx`

Expected: FAIL because the settings components do not exist.

- [ ] **Step 3: Implement the shared card and field primitives**

`SettingsCard` owns a real `<form>`, disabled fieldset, fixed left status border, icon plus status text, live region, and `Save <card>` button. Field primitives generate stable `id`/`aria-describedby` connections. Status uses text/icon in addition to color and only that card disables while saving.

- [ ] **Step 4: Implement seven controlled cards**

- Detection conditionally shows geographic model controls.
- Audio switches between microphone fields and newline RTSP editor; multiple streams reveal a live-stream selector.
- Recording permits blank extraction length and reports its cross-field error locally.
- Storage puts purge/stop consequences beside each radio.
- Review states that species with fewer than the configured lifetime count enter Review when their confidence is also below the Review confidence cutoff.
- Successful saves replace only that card's values with normalized server values; errors preserve edits.

- [ ] **Step 5: Implement route, failure state, and navigation**

The loader calls `getSettingsPage`. The route uses `useServerFn` for seven mutations and passes typed adapters into `SettingsPage`. Its error component explains that BirdNET configuration is unavailable and mentions `BIRDNET_CONF` for development without echoing a path. Add Settings after Stats in `Header.tsx`.

Do not touch `styles.css`; use existing variables and utilities. At wide widths, pair short cards where readable, while preserving DOM/card order; stack everything at mobile width.

- [ ] **Step 6: Generate routes and run GREEN**

Run: `npm run generate-routes`

Run: `npm test -- src/components/settings/settings-page.test.tsx`

Run: `npm test`

Expected: all PASS and `/settings` appears in `routeTree.gen.ts`.

- [ ] **Step 7: Run focused quality checks**

Run: `npm run typecheck`

Run: `npx biome check src/components/settings src/routes/settings.tsx src/lib/settings.ts src/components/Header.tsx src/routeTree.gen.ts`

Expected: no errors. Format only task-owned files.

- [ ] **Step 8: Commit Task 6 paths only**

```powershell
git add -- web-ui/src/components/settings web-ui/src/routes/settings.tsx web-ui/src/components/Header.tsx web-ui/src/routeTree.gen.ts
git commit -m "feat: add card-based settings page"
```

---

### Task 7: Verify the complete settings flow

**Files:**
- Modify only when verification exposes a settings-owned defect.

**Interfaces:**
- Produces verified browser, server, configuration, and Review behavior.

- [ ] **Step 1: Run automated verification from `web-ui/`**

```powershell
npm test
npm run typecheck
npx biome check src/lib/settings-data.ts src/lib/settings-data.test.ts src/lib/settings-config.server.ts src/lib/settings-config.server.test.ts src/lib/settings-system.server.ts src/lib/settings-system.server.test.ts src/lib/settings.server.ts src/lib/settings.server.test.ts src/lib/settings.ts src/components/settings src/routes/settings.tsx src/lib/review.server.ts src/lib/review.server.test.ts src/lib/review.ts src/lib/review-data.ts src/routes/review.tsx src/components/Header.tsx src/routeTree.gen.ts
npm run build
```

Expected: every command exits `0`. Do not run write-mode `npm run clean` while unrelated user changes exist.

- [ ] **Step 2: Start with a temporary development config**

Create an untracked temporary config containing every in-scope key plus `BIRDWEATHER_ID=must-survive`. Start with `BIRDNET_CONF` pointing to it and `BIRDNET_SKIP_SYSTEM_ACTIONS=1`, so no real service or timezone command can run.

- [ ] **Step 3: Verify desktop and narrow layouts in the browser**

Follow the in-app browser skill. Confirm navigation, seven cards on one page, keyboard/focus behavior, labels, independent pending/saved/error states, local validation, RTSP secrecy in errors, readable Storage consequences, and mobile stacking. Leave one card unsaved while saving another and confirm its edit survives.

- [ ] **Step 4: Verify Review end to end**

Change Review rarity, save, navigate to Review, and confirm both queue membership and masthead use the same threshold. Inspect the fixture: only chosen keys changed, the BirdWeather sentinel survived, the Review key occurs once, and no temporary file remains.

- [ ] **Step 5: Run required final reviews**

Read and apply `vercel:react-best-practices` because multiple TSX files were added. Then read and follow `superpowers:verification-before-completion`. Repeat tests, typecheck, focused Biome, and build after any fix.

- [ ] **Step 6: Audit git state and commit verification fixes if needed**

Run `git status --short` and confirm all pre-existing user changes remain separate. If fixes were required, stage only settings-owned paths and commit with `fix: harden settings workflow`; otherwise do not create an empty commit.
