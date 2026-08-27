# Live audio feed — design

**Date:** 2026-08-27
**Status:** Approved for planning

## Summary

Add a live audio listening panel to the Live page (`/live`). BirdNET-Pi already
produces a live stream — `scripts/livestream.sh` runs ffmpeg from the mic (or an
RTSP camera) into an Icecast MP3 stream at `http://localhost:8000/stream`. This
feature wires the browser to that stream and layers the browser-side
enhancements from the reference project
(`github.com/zach7036/BirdNET-Pi-Enhanced-Version`): a gain boost, dynamic
compression, and a real-time scrolling spectrogram — all rendered in our own
palette rather than the reference's neon look.

The panel is **gated**: locked stations see an "unlock to listen" prompt and the
stream cannot be fetched, while the rest of the public Live page is unchanged.

## Goals

- Listen to the station's live feed in the browser (play/pause + volume).
- Boost gain past 100% for quiet/distant birds (browser-side).
- Toggle dynamic-range compression so faint calls become audible.
- Show a live scrolling spectrogram in the site palette.
- Gate the whole panel at both the UI and server layers.
- Degrade gracefully when the stream is offline or unreachable.

## Non-goals (out of scope)

- **Frequency shift.** In this backend it is a baked-in server config
  (`ACTIVATE_FREQSHIFT_IN_LIVESTREAM`, an ffmpeg `rubberband` pitch on the single
  Icecast stream), not a live browser toggle. A real-time version is a separate,
  larger piece of work and is deliberately left out.
- Multi-stream / RTSP source selection in the UI.
- Recording or clipping the live stream from the browser.

## Architecture

### 1. Server proxy — `/api/live-stream`

A new TanStack Start server route proxies the upstream Icecast MP3 to the
browser. Modeled on `web-ui/src/routes/api/audio/$date/$speciesAndFile.ts`.

- Upstream URL resolves from `process.env.LIVE_STREAM_URL`, defaulting to
  `http://localhost:8000/stream`. Resolution lives in a small server helper
  (e.g. `lib/live-stream.server.ts`) so it is unit-testable.
- **Gating (real boundary):** the GET handler calls `readUnlockStatus()` from
  `auth.server.ts` first; if not unlocked it returns `401` before opening any
  upstream connection. This mirrors the intent of the `requireUnlocked`
  middleware (which is function-typed and so can't decorate an API route
  directly).
- Fetches the upstream and pipes its body through with `Content-Type:
  audio/mpeg` and `Cache-Control: no-store`. The MP3 body is streamed, not
  buffered.
- If the upstream is unreachable or returns a non-OK status, the route returns
  `503` so the client can show an offline state. A failed upstream must read as
  offline, never as a crash.

**Why proxy instead of pointing the browser at `:8000` directly:**
- Same-origin — port 8000 need not be exposed to the browser, and there is no
  mixed-content/CORS problem.
- WebAudio can only read samples from a CORS-clean source. Same-origin makes the
  gain, compression, and spectrogram possible; a raw cross-origin `:8000` URL
  would play audibly but silently blank the analyser (tainted source → zeroed
  data).

### 2. Browser audio graph

A single `<audio>` element feeds a WebAudio graph:

```
MediaElementSource → Gain → [Compressor?] → Analyser → destination
```

- **Gain** (`GainNode`) drives the boost slider, ~100%–400% (`gain.value` 1.0–4.0).
- **Compressor** (`DynamicsCompressorNode`) is inserted or bypassed by the
  compression toggle. Bypass reconnects Gain → Analyser directly.
- **Analyser** (`AnalyserNode`, `getByteFrequencyData`) feeds the spectrogram.
- The `AudioContext` is created/resumed on the user's play tap (browsers require
  a gesture; also avoids building the graph for locked/idle visitors).
- The graph is built once and torn down on unmount; nodes are held in refs.

Encapsulated in a hook, e.g. `useLiveAudio()`, returning `{ state, play, pause,
gain, setGain, compression, setCompression, analyser, error }`. The WebAudio
wiring is inherently imperative and hard to unit-test, so it is isolated here and
verified live in the internal browser.

### 3. Spectrogram

A scrolling waterfall on a `<canvas>`, driven by `requestAnimationFrame` reading
`analyser.getByteFrequencyData`. Each frame draws one new column at the right
edge and shifts the prior image left (via `drawImage` of the canvas onto itself,
or an offscreen buffer).

- **Palette (site tokens, not magma):** silence = paper/transparent, rising
  energy ramps `--sage → --moss → --clay`, so the loudest calls glow in the clay
  accent. A pure `magnitude → color` function reads the CSS variables (resolved
  once via `getComputedStyle`) and is unit-testable in isolation.
- Theme-aware: colors come from CSS variables so light/dark both work.
- Animation runs only while playing; it stops on pause and on unmount.

### 4. Panel placement & layout

A full-width `feature-card` on `/live`, placed **directly below** the
`CurrentBirdCard` hero and **above** the `LiveStoryCard`. It uses the existing
`island-kicker` ("Listen") + card idiom so it reads as one of the page's panels.

Inside, top to bottom:
- Spectrogram canvas (the centerpiece).
- Transport row: play/pause button, gain slider, compression toggle.

**States:**
- `locked` — compact "Unlock to listen live" prompt (locked-state idiom); no
  controls, no stream fetch.
- `idle` — calm "Listen live" prompt with a play button; nothing animates.
- `connecting` — after play tap, before audio flows.
- `playing` — spectrogram animating, controls live.
- `paused` — controls live, animation stopped.
- `offline` — upstream unreachable (503); a quiet message instead of a dead
  player, with a retry affordance.

No autoplay in any state.

### 5. UI gating

The Live page stays public. Only the audio panel branches on
`context.auth.unlocked` (already resolved in root route context via
`getUnlockStatusFn`): locked → the "unlock to listen" prompt; unlocked → the
player. This is the render-time layer; the `/api/live-stream` `401` is the real
boundary, so the two lock in lockstep.

## Components & files (anticipated)

- `web-ui/src/routes/api/live-stream.ts` — gated proxy route.
- `web-ui/src/lib/live-stream.server.ts` — upstream URL resolution (env +
  default). Unit-tested.
- `web-ui/src/lib/spectrogram.ts` — pure `magnitude → color` mapping and any
  frequency-bin helpers. Unit-tested.
- `web-ui/src/lib/use-live-audio.ts` — WebAudio graph hook.
- `web-ui/src/components/now/live-audio-card.tsx` — the panel (states, layout,
  gating branch), plus a spectrogram canvas subcomponent.
- `web-ui/src/routes/live.tsx` — render the panel below the hero.

## Error handling

- Upstream down / non-OK → route `503` → panel `offline` state with retry. Never
  a thrown route error.
- Locked → route `401`, panel shows locked prompt. A missing/corrupt auth file
  reads as locked (same as existing auth code).
- WebAudio unsupported or `AudioContext` construction throws → panel falls back
  to a plain audible `<audio>` (play/volume) with the spectrogram/gain hidden, so
  listening still works.

## Testing

- **Unit (tsx test runner):**
  - `live-stream.server.ts`: URL resolution honors `LIVE_STREAM_URL` and falls
    back to the localhost default.
  - `spectrogram.ts`: `magnitude → color` ramp endpoints and monotonic behavior.
- **Live (internal browser only — never Playwright):** play/pause, gain slider
  audibly and visibly affects output, compression toggle, spectrogram animates,
  locked vs unlocked rendering, offline state when the stream is unavailable.

## Open questions

None. Placement (below hero) and palette (site tokens) are settled.
