# Live Audio Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a gated live-audio listening panel to the `/live` page — play/pause, gain boost, dynamic compression, and a real-time spectrogram in the site palette.

**Architecture:** A server route proxies BirdNET-Pi's Icecast MP3 stream same-origin (so WebAudio can read it and no port needs exposing), gated behind the station unlock check. In the browser, a WebAudio graph (`MediaElementSource → Gain → optional Compressor → Analyser → destination`) drives the controls and feeds a scrolling `<canvas>` spectrogram. The panel renders below the hero card and shows a locked prompt when the station is locked.

**Tech Stack:** TanStack Start (React 19), Vite, Web Audio API, native `<canvas>`, Tailwind v4 with CSS-variable design tokens, `node:test` + `tsx` for unit tests, Biome for format/lint.

## Global Constraints

- Package manager & cwd: all `npm` commands run from `web-ui/`.
- Dev server: `npm run dev -- --port 5199 --strictPort` (launch config name `web-ui`, port 5199). Verify UI in the **internal browser only — never Playwright**.
- Unit tests: `node:test` + `node:assert/strict`, files named `*.test.ts` under `web-ui/src`, run with `npm test`.
- Server-only modules end in `.server.ts` and start with `import "@tanstack/react-start/server-only";`.
- Palette tokens (from `web-ui/src/styles.css`): `--paper #fbfdf6`, `--sage #c5ccb6`, `--moss #203b14`, `--clay #9c4a34`. Spectrogram ramps `sage → moss → clay`; no magma/neon.
- Card idiom: full-width `feature-card rounded-md p-4` with an `island-kicker` label, matching `live-story-card.tsx`.
- Shared working tree: many sessions share this checkout — always `git add` explicit paths, never `git add -A`/`.`.
- After finishing code, run `npm run clean` (Biome check + `tsc --noEmit`) and confirm it passes before the final commit.

---

## File Structure

- `web-ui/src/lib/live-stream.server.ts` — resolve the upstream Icecast URL from env + default. (Task 1)
- `web-ui/src/lib/live-stream.server.test.ts` — unit tests for resolution. (Task 1)
- `web-ui/src/routes/api/live-stream.ts` — gated proxy route. (Task 2)
- `web-ui/src/lib/spectrogram.ts` — pure magnitude→color ramp. (Task 3)
- `web-ui/src/lib/spectrogram.test.ts` — unit tests for the ramp. (Task 3)
- `web-ui/src/lib/use-live-audio.ts` — WebAudio graph hook. (Task 4)
- `web-ui/src/components/now/live-audio-card.tsx` — the panel: states, gating branch, controls, spectrogram canvas. (Task 5)
- `web-ui/src/routes/live.tsx` — render the panel below the hero. (Task 6)

---

## Task 1: Upstream stream-URL resolution

**Files:**
- Create: `web-ui/src/lib/live-stream.server.ts`
- Test: `web-ui/src/lib/live-stream.server.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `resolveLiveStreamUrl(env?: NodeJS.ProcessEnv): string` — returns `env.LIVE_STREAM_URL` when set and non-empty (trimmed), else the default `"http://localhost:8000/stream"`.

- [ ] **Step 1: Write the failing test**

Create `web-ui/src/lib/live-stream.server.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_LIVE_STREAM_URL, resolveLiveStreamUrl } from "./live-stream.server.ts";

test("falls back to the localhost Icecast default when unset", () => {
	assert.equal(resolveLiveStreamUrl({}), DEFAULT_LIVE_STREAM_URL);
	assert.equal(DEFAULT_LIVE_STREAM_URL, "http://localhost:8000/stream");
});

test("honors LIVE_STREAM_URL when set", () => {
	assert.equal(
		resolveLiveStreamUrl({ LIVE_STREAM_URL: "http://pi.local:8000/stream" }),
		"http://pi.local:8000/stream",
	);
});

test("treats a blank or whitespace LIVE_STREAM_URL as unset", () => {
	assert.equal(resolveLiveStreamUrl({ LIVE_STREAM_URL: "   " }), DEFAULT_LIVE_STREAM_URL);
	assert.equal(resolveLiveStreamUrl({ LIVE_STREAM_URL: "" }), DEFAULT_LIVE_STREAM_URL);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `web-ui/`): `npm test`
Expected: FAIL — cannot find module `./live-stream.server.ts`.

- [ ] **Step 3: Write minimal implementation**

Create `web-ui/src/lib/live-stream.server.ts`:

```ts
import "@tanstack/react-start/server-only";

/** BirdNET-Pi's `livestream.sh` publishes the mic/RTSP feed here by default. */
export const DEFAULT_LIVE_STREAM_URL = "http://localhost:8000/stream";

/**
 * The upstream MP3 the /api/live-stream route proxies. Overridable via
 * LIVE_STREAM_URL for stations whose Icecast lives elsewhere; a blank value is
 * treated as unset so an empty env line can't point the proxy at nothing.
 */
export function resolveLiveStreamUrl(env: NodeJS.ProcessEnv = process.env): string {
	const configured = env.LIVE_STREAM_URL?.trim();
	return configured ? configured : DEFAULT_LIVE_STREAM_URL;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `web-ui/`): `npm test`
Expected: PASS — all three tests green.

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/lib/live-stream.server.ts web-ui/src/lib/live-stream.server.test.ts
git commit -m "feat(live): resolve upstream live-stream URL from env"
```

---

## Task 2: Gated proxy route `/api/live-stream`

**Files:**
- Create: `web-ui/src/routes/api/live-stream.ts`

**Interfaces:**
- Consumes: `resolveLiveStreamUrl` (Task 1); `readUnlockStatus` from `~/lib/auth.server.ts` returning `{ unlocked: boolean; isDefaultPassword: boolean }`.
- Produces: `GET /api/live-stream` — `401` when locked, `503` when upstream is unreachable/non-OK, else a streamed `audio/mpeg` response.

Modeled on `web-ui/src/routes/api/audio/$date/$speciesAndFile.ts`. This route streams a live upstream and cannot be meaningfully unit-tested without a network; it is verified live in Task 6. Keep it small and correct.

- [ ] **Step 1: Write the route**

Create `web-ui/src/routes/api/live-stream.ts`:

```ts
import { createFileRoute } from "@tanstack/react-router";

import { readUnlockStatus } from "~/lib/auth.server.ts";
import { resolveLiveStreamUrl } from "~/lib/live-stream.server.ts";

export const Route = createFileRoute("/api/live-stream")({
	server: {
		handlers: {
			GET: async () => {
				// The real gate: refuse before opening any upstream connection. A
				// missing/corrupt auth file reads as locked (readUnlockStatus never
				// throws "open"), same promise every gated endpoint makes.
				let unlocked = false;
				try {
					({ unlocked } = await readUnlockStatus());
				} catch {
					unlocked = false;
				}
				if (!unlocked) return new Response("Locked", { status: 401 });

				let upstream: Response;
				try {
					upstream = await fetch(resolveLiveStreamUrl());
				} catch {
					// Icecast down / host unreachable reads as offline, never a crash.
					return new Response("Live stream unavailable", { status: 503 });
				}
				if (!upstream.ok || !upstream.body) {
					return new Response("Live stream unavailable", { status: 503 });
				}

				// Pipe the MP3 body straight through -- never buffer a live stream.
				return new Response(upstream.body, {
					headers: {
						"Content-Type": "audio/mpeg",
						"Cache-Control": "no-store",
					},
				});
			},
		},
	},
});
```

- [ ] **Step 2: Regenerate the route tree**

Run (from `web-ui/`): `npm run generate-routes`
Expected: completes without error; `/api/live-stream` is registered.

- [ ] **Step 3: Typecheck**

Run (from `web-ui/`): `npm run typecheck`
Expected: PASS — no type errors.

- [ ] **Step 4: Commit**

```bash
git add web-ui/src/routes/api/live-stream.ts web-ui/src/routeTree.gen.ts
git commit -m "feat(live): add gated live-stream proxy route"
```

Note: if `npm run generate-routes` did not touch `routeTree.gen.ts`, drop it from the `git add` line.

---

## Task 3: Spectrogram color ramp (pure)

**Files:**
- Create: `web-ui/src/lib/spectrogram.ts`
- Test: `web-ui/src/lib/spectrogram.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Rgb = [number, number, number]`
  - `rampColor(stops: Rgb[], t: number): Rgb` — piecewise-linear interpolation across evenly-spaced `stops`; `t` clamped to `[0, 1]`. Requires `stops.length >= 2`.

The panel supplies real token colors (resolved from CSS variables, so theme-aware) as `stops`; keeping the math pure and stop-agnostic makes it testable without a DOM.

- [ ] **Step 1: Write the failing test**

Create `web-ui/src/lib/spectrogram.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { rampColor, type Rgb } from "./spectrogram.ts";

const STOPS: Rgb[] = [
	[0, 0, 0],
	[100, 100, 100],
	[200, 200, 200],
];

test("returns the first stop at t=0 and the last at t=1", () => {
	assert.deepEqual(rampColor(STOPS, 0), [0, 0, 0]);
	assert.deepEqual(rampColor(STOPS, 1), [200, 200, 200]);
});

test("interpolates linearly within a segment", () => {
	// t=0.25 lands halfway into the first of two segments -> [50,50,50]
	assert.deepEqual(rampColor(STOPS, 0.25), [50, 50, 50]);
	// t=0.75 lands halfway into the second segment -> [150,150,150]
	assert.deepEqual(rampColor(STOPS, 0.75), [150, 150, 150]);
});

test("clamps t outside [0,1]", () => {
	assert.deepEqual(rampColor(STOPS, -1), [0, 0, 0]);
	assert.deepEqual(rampColor(STOPS, 2), [200, 200, 200]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `web-ui/`): `npm test`
Expected: FAIL — cannot find module `./spectrogram.ts`.

- [ ] **Step 3: Write minimal implementation**

Create `web-ui/src/lib/spectrogram.ts`:

```ts
export type Rgb = [number, number, number];

/**
 * Piecewise-linear color ramp across evenly-spaced `stops`. Kept pure and
 * stop-agnostic so callers can pass the site's own tokens (resolved from CSS
 * variables, so it adapts to the theme) and the mapping stays unit-testable
 * without a DOM. `t` is clamped to [0, 1]; `stops` must hold at least two.
 */
export function rampColor(stops: Rgb[], t: number): Rgb {
	const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
	const segments = stops.length - 1;
	const scaled = clamped * segments;
	const index = Math.min(Math.floor(scaled), segments - 1);
	const frac = scaled - index;
	const from = stops[index];
	const to = stops[index + 1];
	return [
		Math.round(from[0] + (to[0] - from[0]) * frac),
		Math.round(from[1] + (to[1] - from[1]) * frac),
		Math.round(from[2] + (to[2] - from[2]) * frac),
	];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `web-ui/`): `npm test`
Expected: PASS — all ramp tests green.

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/lib/spectrogram.ts web-ui/src/lib/spectrogram.test.ts
git commit -m "feat(live): add pure spectrogram color ramp"
```

---

## Task 4: WebAudio graph hook `useLiveAudio`

**Files:**
- Create: `web-ui/src/lib/use-live-audio.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (the panel passes the stream URL in).
- Produces:

```ts
type LiveAudioState = "idle" | "connecting" | "playing" | "paused" | "offline";

interface UseLiveAudio {
	audioRef: React.RefObject<HTMLAudioElement | null>;
	state: LiveAudioState;
	gainPercent: number;       // 100..400
	setGainPercent: (pct: number) => void;
	compression: boolean;
	setCompression: (on: boolean) => void;
	analyser: AnalyserNode | null;
	play: () => Promise<void>;
	pause: () => void;
	// wire onto the <audio> element:
	onPlaying: () => void;
	onPause: () => void;
	onError: () => void;
	onWaiting: () => void;
}

export function useLiveAudio(streamUrl: string): UseLiveAudio;
```

The WebAudio wiring is imperative and DOM-bound, so it is isolated here and verified live in Task 6 rather than unit-tested.

- [ ] **Step 1: Write the hook**

Create `web-ui/src/lib/use-live-audio.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from "react";

export type LiveAudioState = "idle" | "connecting" | "playing" | "paused" | "offline";

const MIN_GAIN_PERCENT = 100;
const MAX_GAIN_PERCENT = 400;

/**
 * Owns the Web Audio graph behind the live panel:
 *   MediaElementSource -> Gain -> [Compressor] -> Analyser -> destination
 * The graph is built lazily on the first play() (browsers require a user
 * gesture to start an AudioContext, and a locked/idle visitor should never
 * open one). Compression is toggled by re-linking Gain to either the
 * compressor or straight to the analyser.
 */
export function useLiveAudio(streamUrl: string) {
	const audioRef = useRef<HTMLAudioElement>(null);
	const ctxRef = useRef<AudioContext | null>(null);
	const gainRef = useRef<GainNode | null>(null);
	const compressorRef = useRef<DynamicsCompressorNode | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);

	const [state, setState] = useState<LiveAudioState>("idle");
	const [gainPercent, setGainPercentState] = useState(MIN_GAIN_PERCENT);
	const [compression, setCompressionState] = useState(false);
	const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

	// Rebuilds the Gain -> (Compressor?) -> Analyser links for the current
	// compression setting. Analyser -> destination is wired once at build time.
	const relink = useCallback((withCompression: boolean) => {
		const gain = gainRef.current;
		const compressor = compressorRef.current;
		const analyserNode = analyserRef.current;
		if (!gain || !compressor || !analyserNode) return;
		gain.disconnect();
		compressor.disconnect();
		if (withCompression) {
			gain.connect(compressor);
			compressor.connect(analyserNode);
		} else {
			gain.connect(analyserNode);
		}
	}, []);

	const ensureGraph = useCallback(() => {
		if (ctxRef.current) return;
		const audio = audioRef.current;
		if (!audio) return;
		const ctx = new AudioContext();
		const source = ctx.createMediaElementSource(audio);
		const gain = ctx.createGain();
		gain.gain.value = gainPercent / 100;
		const compressor = ctx.createDynamicsCompressor();
		const analyserNode = ctx.createAnalyser();
		analyserNode.fftSize = 1024;
		analyserNode.smoothingTimeConstant = 0.6;

		source.connect(gain);
		analyserNode.connect(ctx.destination);

		ctxRef.current = ctx;
		gainRef.current = gain;
		compressorRef.current = compressor;
		analyserRef.current = analyserNode;
		relink(compression);
		setAnalyser(analyserNode);
	}, [compression, gainPercent, relink]);

	const play = useCallback(async () => {
		const audio = audioRef.current;
		if (!audio) return;
		setState("connecting");
		try {
			ensureGraph();
			await ctxRef.current?.resume();
			// Assigning src here (not in markup) keeps a locked/idle visitor from
			// ever opening the gated proxy connection.
			if (!audio.src) audio.src = streamUrl;
			await audio.play();
		} catch {
			setState("offline");
		}
	}, [ensureGraph, streamUrl]);

	const pause = useCallback(() => {
		audioRef.current?.pause();
	}, []);

	const setGainPercent = useCallback((pct: number) => {
		const clamped = Math.min(MAX_GAIN_PERCENT, Math.max(MIN_GAIN_PERCENT, pct));
		setGainPercentState(clamped);
		if (gainRef.current) gainRef.current.gain.value = clamped / 100;
	}, []);

	const setCompression = useCallback(
		(on: boolean) => {
			setCompressionState(on);
			relink(on);
		},
		[relink],
	);

	useEffect(() => {
		return () => {
			ctxRef.current?.close();
		};
	}, []);

	return {
		audioRef,
		state,
		gainPercent,
		setGainPercent,
		compression,
		setCompression,
		analyser,
		play,
		pause,
		onPlaying: () => setState("playing"),
		onPause: () => setState((s) => (s === "offline" ? s : "paused")),
		onError: () => setState("offline"),
		onWaiting: () => setState((s) => (s === "playing" ? s : "connecting")),
	};
}
```

- [ ] **Step 2: Typecheck**

Run (from `web-ui/`): `npm run typecheck`
Expected: PASS — no type errors.

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/lib/use-live-audio.ts
git commit -m "feat(live): add WebAudio graph hook for live listening"
```

---

## Task 5: Live audio panel `LiveAudioCard`

**Files:**
- Create: `web-ui/src/components/now/live-audio-card.tsx`

**Interfaces:**
- Consumes: `useLiveAudio` (Task 4); `rampColor`, `Rgb` (Task 3); `Button` (`~/components/ui/button.tsx`, has an `icon` prop); `Toggle` (`~/components/ui/toggle.tsx`, radix — `pressed` / `onPressedChange`).
- Produces: `LiveAudioCard({ unlocked }: { unlocked: boolean })`.

- [ ] **Step 1: Write the component**

Create `web-ui/src/components/now/live-audio-card.tsx`:

```tsx
import { AudioWaveform, LockKeyhole, Pause, Play } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "~/components/ui/button.tsx";
import { Toggle } from "~/components/ui/toggle.tsx";
import { rampColor, type Rgb } from "~/lib/spectrogram.ts";
import { useLiveAudio } from "~/lib/use-live-audio.ts";

const STREAM_URL = "/api/live-stream";

/**
 * Live listening for the station's feed. Gated: a locked station sees the
 * prompt below and never opens the (also-gated) stream. Unlocked, it plays the
 * proxied Icecast MP3 through a WebAudio graph and paints a scrolling
 * spectrogram in the site palette.
 */
export function LiveAudioCard({ unlocked }: { unlocked: boolean }) {
	if (!unlocked) return <LockedPanel />;
	return <PlayerPanel />;
}

function CardShell({ children }: { children: React.ReactNode }) {
	return (
		<section aria-label="Live audio" className="feature-card rounded-md p-4">
			<div className="island-kicker">Listen</div>
			<div className="mt-4">{children}</div>
		</section>
	);
}

function LockedPanel() {
	return (
		<CardShell>
			<div className="flex items-center gap-3">
				<div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--sage)_30%,var(--paper-raised))]">
					<LockKeyhole aria-hidden="true" className="size-4 text-[var(--moss)]" />
				</div>
				<p className="text-muted-foreground text-sm">
					Unlock the station to listen to the live feed.
				</p>
			</div>
		</CardShell>
	);
}

function PlayerPanel() {
	const live = useLiveAudio(STREAM_URL);
	const isPlaying = live.state === "playing";
	const isOffline = live.state === "offline";

	return (
		<CardShell>
			<Spectrogram analyser={live.analyser} active={isPlaying} />

			{isOffline ? (
				<p className="mt-3 text-destructive text-sm">
					The live stream is offline. Check that the audio service is running,
					then try again.
				</p>
			) : null}

			<div className="mt-4 flex flex-wrap items-center gap-4">
				<Button
					type="button"
					icon={isPlaying ? Pause : Play}
					onClick={() => (isPlaying ? live.pause() : live.play())}
				>
					{live.state === "connecting"
						? "Connecting…"
						: isPlaying
							? "Pause"
							: isOffline
								? "Retry"
								: "Listen live"}
				</Button>

				<label className="flex items-center gap-2 text-sm">
					<span className="text-muted-foreground">Gain</span>
					<input
						type="range"
						min={100}
						max={400}
						step={5}
						value={live.gainPercent}
						onChange={(e) => live.setGainPercent(Number(e.target.value))}
						className="accent-[var(--moss)]"
						aria-label="Gain"
					/>
					<span className="tabular-data w-10 text-right">{live.gainPercent}%</span>
				</label>

				<Toggle
					variant="outline"
					size="sm"
					pressed={live.compression}
					onPressedChange={live.setCompression}
					aria-label="Compression"
				>
					<AudioWaveform aria-hidden="true" />
					Compression
				</Toggle>
			</div>

			{/* The graph reads samples from this element; it carries no controls of
			    its own. src is set in the hook on first play so a locked/idle
			    visitor never opens the proxy connection. */}
			{/* biome-ignore lint/a11y/useMediaCaption: a live station feed has no captions track */}
			<audio
				ref={live.audioRef}
				onPlaying={live.onPlaying}
				onPause={live.onPause}
				onError={live.onError}
				onWaiting={live.onWaiting}
				crossOrigin="anonymous"
			/>
		</CardShell>
	);
}

const SPECTROGRAM_HEIGHT = 160;

/** Scrolling waterfall: one new column per frame at the right edge, prior image
    shifted left. Colors come from the live tokens so it tracks the theme. */
function Spectrogram({
	analyser,
	active,
}: {
	analyser: AnalyserNode | null;
	active: boolean;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !analyser || !active) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const styles = getComputedStyle(canvas);
		const stops: Rgb[] = [
			readRgb(styles.getPropertyValue("--sage"), [197, 204, 182]),
			readRgb(styles.getPropertyValue("--moss"), [32, 59, 20]),
			readRgb(styles.getPropertyValue("--clay"), [156, 74, 52]),
		];
		const background = readRgb(styles.getPropertyValue("--paper"), [251, 253, 246]);

		const bins = analyser.frequencyBinCount;
		const data = new Uint8Array(bins);
		let raf = 0;

		const draw = () => {
			raf = requestAnimationFrame(draw);
			const w = canvas.width;
			const h = canvas.height;
			// Shift everything one column left, then draw the new column at the edge.
			ctx.drawImage(canvas, -1, 0);
			analyser.getByteFrequencyData(data);
			for (let y = 0; y < h; y++) {
				// Low frequencies at the bottom, like the reference spectrogram.
				const bin = Math.floor(((h - 1 - y) / h) * bins);
				const magnitude = data[bin] / 255;
				const [r, g, b] =
					magnitude <= 0.02 ? background : rampColor(stops, magnitude);
				ctx.fillStyle = `rgb(${r},${g},${b})`;
				ctx.fillRect(w - 1, y, 1, 1);
			}
		};
		raf = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(raf);
	}, [analyser, active]);

	return (
		<canvas
			ref={canvasRef}
			width={640}
			height={SPECTROGRAM_HEIGHT}
			className="h-40 w-full rounded-md border border-[var(--line)] bg-[var(--paper)]"
			aria-hidden="true"
		/>
	);
}

/** Parses `#rrggbb` (the raw form our palette tokens use) to an Rgb triple. */
function readRgb(value: string, fallback: Rgb): Rgb {
	const hex = value.trim().replace("#", "");
	if (hex.length !== 6) return fallback;
	const n = Number.parseInt(hex, 16);
	if (Number.isNaN(n)) return fallback;
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
```

- [ ] **Step 2: Typecheck**

Run (from `web-ui/`): `npm run typecheck`
Expected: PASS. If the `biome-ignore` comment is rejected, adjust its rule name to match the Biome a11y rule reported by `npm run lint`.

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/components/now/live-audio-card.tsx
git commit -m "feat(live): add gated live audio panel with spectrogram"
```

---

## Task 6: Wire the panel into the Live page + live verification

**Files:**
- Modify: `web-ui/src/routes/live.tsx`

**Interfaces:**
- Consumes: `LiveAudioCard` (Task 5); `context.auth.unlocked` from root route context (already resolved in `__root.tsx` via `getUnlockStatusFn`).
- Produces: the panel rendered on `/live`, below the hero and above the story.

- [ ] **Step 1: Read the auth flag in the route**

In `web-ui/src/routes/live.tsx`, the `loader` currently returns `{ snapshot, story }`. Add the unlock flag from loader context so the panel can render server-side. Change the loader signature to accept context and include `unlocked`:

```tsx
	loader: async ({ context }) => {
		const [snapshot, story] = await Promise.all([
			getNowSnapshot(),
			getTodaysStory(),
		]);
		return { snapshot, story, unlocked: context.auth.unlocked };
	},
```

- [ ] **Step 2: Render the panel below the hero**

Add the import at the top of `web-ui/src/routes/live.tsx`:

```tsx
import { LiveAudioCard } from "~/components/now/live-audio-card.tsx";
```

Read `unlocked` from loader data (update the destructure in `Live()`):

```tsx
	const { snapshot: initialSnapshot, story, unlocked } = Route.useLoaderData();
```

Insert the panel between `<CurrentBirdCard … />` and `<LiveStoryCard … />`:

```tsx
			<CurrentBirdCard
				current={snapshot.current}
				summary={snapshot.summary}
				offsetMs={offsetMs}
				flash={heroIsNew}
			/>

			<LiveAudioCard unlocked={unlocked} />

			<LiveStoryCard lines={story} className="mt-4" />
```

Note: `LiveAudioCard`'s shell has no top margin of its own; add `mt-4` on it to match the story's spacing:

```tsx
			<div className="mt-4">
				<LiveAudioCard unlocked={unlocked} />
			</div>
```

- [ ] **Step 3: Typecheck**

Run (from `web-ui/`): `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Start the dev server and open the Live page**

Use the internal browser (never Playwright). Start the `web-ui` launch config and navigate to `http://localhost:5199/live`.
Expected: the hero card, then a "Listen" card, then the story. While locked, the card shows "Unlock the station to listen to the live feed."

- [ ] **Step 5: Verify the locked path**

With the station locked, confirm the panel shows the locked prompt and no player controls. In the internal browser, request `/api/live-stream` directly.
Expected: `401` response (locked), no audio.

- [ ] **Step 6: Verify the unlocked path**

Unlock the station (enter the station password on the Settings page, or via the unlock gate). Return to `/live`.
Expected: the panel now shows the play button, gain slider, and compression toggle. Press "Listen live":
- If the Icecast stream is running: audio plays, `state` becomes `playing`, and the spectrogram animates. Move the gain slider — output gets louder and the spectrogram brightens. Toggle compression — dynamics even out.
- If the stream is not running in this environment: the panel shows the offline message and the button reads "Retry". Confirm `/api/live-stream` returns `503`. This still verifies the gating + offline path; note in the report that live playback needs a running Icecast to fully confirm.

Use `read_console_messages` to confirm no WebAudio/CORS errors (a CORS error here would mean the proxy isn't same-origin — it should be).

- [ ] **Step 7: Run the full clean pass**

Run (from `web-ui/`): `npm run clean`
Expected: Biome check + `tsc --noEmit` both pass. Fix anything they flag.

- [ ] **Step 8: Commit**

```bash
git add web-ui/src/routes/live.tsx
git commit -m "feat(live): show live audio panel below the hero on /live"
```

---

## Self-Review

**Spec coverage:**
- Server proxy `/api/live-stream` (env + default, streamed, 503 on failure) — Task 2 (+ Task 1 for URL). ✓
- Gating both layers (401 server, locked UI branch) — Task 2 (401) + Task 5 (`LockedPanel`) + Task 6 (`unlocked` flag). ✓
- WebAudio graph: gain → optional compressor → analyser — Task 4. ✓
- Gain boost slider 100–400% — Task 4 (`setGainPercent`) + Task 5 (range input). ✓
- Compression toggle — Task 4 (`setCompression` relink) + Task 5 (`Toggle`). ✓
- Spectrogram in site palette (sage→moss→clay), theme-aware — Task 3 (ramp) + Task 5 (`Spectrogram`, tokens via `getComputedStyle`). ✓
- Placement below hero, above story, `feature-card`/`island-kicker` — Task 6 + Task 5 `CardShell`. ✓
- States idle/connecting/playing/paused/offline, no autoplay — Task 4 state machine + Task 5 rendering. ✓
- Graceful offline + retry — Task 2 (503) + Task 5 (offline message/Retry). ✓
- Frequency shift explicitly out of scope — not implemented, as specified. ✓
- Tests: `live-stream.server` resolution, `spectrogram` ramp; WebAudio/canvas verified live — Tasks 1, 3, 6. ✓

**Placeholder scan:** No TBD/TODO; all code steps carry complete code and exact commands. ✓

**Type consistency:** `resolveLiveStreamUrl`/`DEFAULT_LIVE_STREAM_URL` (Task 1) used in Task 2. `rampColor`/`Rgb` (Task 3) used in Task 5. `useLiveAudio` return shape (Task 4) matches Task 5 usage (`state`, `gainPercent`, `setGainPercent`, `compression`, `setCompression`, `analyser`, `play`, `pause`, `audioRef`, `onPlaying`/`onPause`/`onError`/`onWaiting`). `LiveAudioCard({ unlocked })` (Task 5) matches Task 6 call. ✓
