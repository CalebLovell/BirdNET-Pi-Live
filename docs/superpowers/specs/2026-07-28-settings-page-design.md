# Settings Page Design

## Goal

Add one `/settings` page to BirdNET-Pi Live where station owners can configure the operational settings that currently require editing `birdnet.conf`. The page uses independently saved cards for Station, Detection, Privacy, Audio input, Recording, Storage, and the Review queue. BirdWeather, notifications, public URL, diagnostics, and legacy PHP-only presentation settings are outside this feature.

## Product and visual direction

The page is a control surface for the owner of a local BirdNET-Pi station. Its single job is to make consequential station configuration understandable without exposing the shape of the underlying shell configuration.

The page follows the existing field-guide visual system: paper and moss colors, Georgia typography, quiet bordered surfaces, compact explanatory copy, and responsive spacing. A short page header explains that each section saves separately. Beneath it, cards form a single vertical reading flow; cards may share a two-column grid at wide widths where their content remains readable, but there are no tabs. Each card has its own status message and `Save` button. The memorable device is a slim card-edge status strip that changes from neutral to saved or attention-needed, making the state of each independent subsystem visible without adding dashboard ornament.

The page remains usable at mobile widths, has visible keyboard focus, labels every control, associates errors with fields, and does not rely on color alone for save status. Motion is limited to the existing transition system and respects reduced-motion preferences.

## Navigation and page structure

Add `Settings` to the primary header navigation and create `web-ui/src/routes/settings.tsx`.

The cards appear in this order:

1. Station
2. Detection
3. Privacy
4. Audio input
5. Recording
6. Storage
7. Review queue

This is intentionally one page. Each card owns its form state, validation display, pending state, save result, and server call. Saving one card never submits unsaved values from another card.

## Configuration source of truth

`birdnet.conf` remains the only source of truth for these settings. The server resolves its path from `BIRDNET_CONF`, falling back to `/etc/birdnet/birdnet.conf`. Tests and local development can point `BIRDNET_CONF` at a fixture.

The settings layer parses simple `KEY=value` assignments while retaining the original file text. Saving a card:

1. Validates an allowlisted, typed payload.
2. Reads the latest file contents to avoid overwriting changes made after page load.
3. Replaces only that card's allowlisted assignment lines.
4. Appends `REVIEW_RARE_SPECIES_MAX` when upgrading an older file where it is absent.
5. Writes a sibling temporary file, preserves the original mode, and atomically renames it over the configuration file.
6. Runs only the system side effects assigned to that card.
7. Returns the normalized saved values and a restart result.

Comments, ordering, unknown keys, and values owned by omitted integrations are preserved. Scalar values reject control characters and newlines. String serialization quotes and escapes values where the existing shell configuration expects quotes. The client never supplies arbitrary key names, file paths, service names, or shell commands.

## Card contracts

### Station

- `SITE_NAME`: trimmed text, 0–80 characters.
- `LATITUDE`: finite number from -90 through 90.
- `LONGITUDE`: finite number from -180 through 180.
- Timezone: an IANA timezone selected from the server's supported timezone list. It is an operating-system property rather than a new `birdnet.conf` key.

Saving coordinates restarts `birdnet_analysis.service` so cached geographic model state is discarded. Saving a changed timezone runs `timedatectl set-timezone` through a fixed-argument privileged command and updates `/etc/timezone` when that file exists. A configuration save that succeeds while a restart or timezone command fails returns a partial-success result: the UI says the values were saved and identifies the system action that still needs attention.

### Detection

- `MODEL`: one of the model identifiers supported by `scripts/utils/models.py` and backed by an installed `.tflite` file. The UI labels unsupported or missing current values without silently replacing them.
- `DATA_MODEL_VERSION`: integer `1` or `2`; shown only for models that support the geographic metadata model.
- `SF_THRESH`: number from `0.0005` through `0.99`; shown with the range-model controls.
- `CONFIDENCE`: number from `0.01` through `0.99`.
- `SENSITIVITY`: number from `0.5` through `1.5`.
- `OVERLAP`: number from `0` through `2.9`.

Saving restarts `birdnet_analysis.service`. Copy explains the practical effects: confidence controls which predictions become detections, sensitivity changes model scoring, overlap increases analysis coverage and compute cost, and the species-frequency threshold narrows candidates based on location and season.

### Privacy

- `PRIVACY_THRESHOLD`: number from `0` through `3`, where `0` disables human-sound suppression and larger values inspect a broader portion of predictions.

Saving restarts `birdnet_analysis.service`. The card explains that matching chunks and their neighbors are suppressed, and that this is a mitigation rather than a guarantee that speech can never be recorded.

### Audio input

- Input mode: derived from whether `RTSP_STREAM` is empty; it is not stored as a separate key.
- `REC_CARD`: trimmed ALSA/PulseAudio device identifier, required in microphone mode.
- `CHANNELS`: integer from `1` through `32`.
- `RTSP_STREAM`: zero or more `rtsp://` or `rtsps://` URLs entered one per line and serialized into the comma-separated format expected by the existing scripts.
- `RTSP_STREAM_TO_LIVESTREAM`: zero-based integer selecting one configured RTSP stream for the live player; shown only when multiple streams exist and constrained to their indexes.

Saving restarts `birdnet_recording.service`, `livestream.service`, and `spectrogram_viewer.service`. The first version does not add device discovery or a recording test because those require separate operating-system probes and UI states; the card uses explicit identifiers and examples instead.

RTSP URLs may contain credentials. They remain server-side until this local-network settings page loads and are never written to logs or returned in save-error details. Authentication and broader remote-access hardening remain a separate project, consistent with the app's current local-network trust model.

### Recording

- `RECORDING_LENGTH`: integer from `3` through `60` seconds.
- `EXTRACTION_LENGTH`: blank for the backend default, or an integer from `3` through `RECORDING_LENGTH`.
- `AUDIOFMT`: `mp3`, `wav`, `flac`, or `ogg`, matching formats understood by the new web audio route.

Saving restarts `birdnet_recording.service`, `birdnet_analysis.service`, and `spectrogram_viewer.service`. Validation prevents extraction length from exceeding recording length. The existing `RAW_SPECTROGRAM` presentation option is not included.

### Storage

- `FULL_DISK`: `purge` or `keep`. `purge` removes old data when the threshold is crossed; `keep` stops core services instead.
- `PURGE_THRESHOLD`: integer from `20` through `99`, representing disk-used percentage.
- `MAX_FILES_SPECIES`: non-negative integer; `0` keeps every recording, subject to full-disk handling.

Saving does not restart services because the cleanup scripts read the configuration when they run. The purge and stop consequences are written next to the choice rather than hidden in a tooltip.

### Review queue

- `REVIEW_RARE_SPECIES_MAX`: integer from `1` through `10,000`, defaulting to `10` when the key is missing.

This key deliberately does not reuse upstream's `RARE_SPECIES_THRESHOLD`, whose meaning is a number of days. Here the value means: include detections from species whose lifetime detection count is strictly less than the configured number. Saving requires no service restart.

The Review loader reads the value server-side for every page load. `loadReviewPage` accepts the validated threshold and binds it as a SQLite query parameter rather than interpolating it into SQL. `ReviewPage` carries the applied threshold so the header description always describes the same criterion used by the query. The old exported `RARE_SPECIES_MAX` constant is removed, while a default constant remains available only inside the configuration normalization layer.

## Server boundary and system actions

Create a server-only settings module containing:

- Configuration path resolution, parsing, normalization, serialization, and atomic update functions.
- Per-card schemas and exported TypeScript result types.
- A fixed service-restart map keyed by card identifier.
- A command runner that uses argument arrays, never a client-created shell string.
- Timezone enumeration and update helpers.

Create a companion isomorphic module containing form-safe types, defaults, and pure validators. TanStack server functions expose one read operation and one POST operation per card. Server errors are converted to concise user-facing results; raw command output, configuration contents, tokens embedded in RTSP URLs, and filesystem paths are not sent to the browser.

In development or tests on non-Linux hosts, configuration reading and writing still works when `BIRDNET_CONF` is provided. System actions are disabled with `BIRDNET_SKIP_SYSTEM_ACTIONS=1`; the returned result explicitly says that no restart was attempted. Production installation must run the Node service as a user that can write the linked configuration file and invoke the fixed `systemctl` and `timedatectl` commands without an interactive password.

## Error handling and concurrency

- Loader failure renders a page-level message naming the unavailable configuration and how to provide `BIRDNET_CONF`; it does not render fabricated editable defaults.
- Field validation errors stay within the relevant card and do not affect other cards.
- Buttons are disabled only while their own card is saving.
- Atomic replacement prevents readers from seeing a partially written configuration.
- Each update reads the latest file immediately before replacement, reducing lost updates between independently saved cards.
- If file writing fails, no restart is attempted.
- If writing succeeds and a system action fails, the new configuration remains saved and the result is reported as partial success.

## Testing

Use test-driven development for all new behavior.

Pure unit tests cover:

- Parsing quoted, unquoted, blank, and missing keys.
- Updating one card without changing comments, ordering, or unrelated settings.
- Appending and defaulting `REVIEW_RARE_SPECIES_MAX`.
- String escaping and newline rejection.
- Every numeric boundary and cross-field rule.
- RTSP line-to-comma normalization and live-index validation.
- Service selection for every card.

Filesystem tests use temporary fixture files to verify atomic updates and preservation of unrelated content. Command execution is dependency-injected so tests assert fixed executable/argument pairs without invoking system services.

Review tests prove that two different configured thresholds produce different queues, that the boundary is strictly less than the threshold, and that the returned page exposes the applied threshold. Route/component tests or rendered markup assertions cover card order, per-card save controls, accessible labels, and status/error rendering where practical. Final verification runs the complete web test suite, typecheck, lint/check, and production build.

## Explicitly excluded

- BirdWeather
- Apprise notifications
- Public URL configuration
- Diagnostics and log levels
- Home Assistant weather
- Display units, theme, Flickr, external species-info provider, sidebar label, custom HTML, and custom homepage image
- Automatic updates and update indicators
- Frequency shifting
- Manual system date setting
- Database-language migration
- Authentication redesign
- Audio-device discovery and test recording

