import { useCallback, useEffect, useRef, useState } from "react";

export type LiveAudioState =
	| "idle"
	| "connecting"
	| "playing"
	| "paused"
	| "offline";

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
