import { useEffect, useRef, useState } from "react";

// The browser's native <audio src> loading doesn't reliably reach this app's
// dynamic audio route (some Sec-Fetch-Dest-specific behavior in this dev
// stack), but a plain fetch() always does -- so fetch it ourselves and play
// from a local blob instead.
export function usePlayableAudio(audioUrl: string | null) {
	const audioRef = useRef<HTMLAudioElement>(null);
	const objectUrlRef = useRef<string | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		return () => {
			if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
		};
	}, []);

	async function togglePlay() {
		const audio = audioRef.current;
		if (!audio || !audioUrl) return;

		if (isPlaying) {
			audio.pause();
			return;
		}

		if (!objectUrlRef.current) {
			setIsLoading(true);
			try {
				const response = await fetch(audioUrl);
				if (!response.ok) throw new Error("Failed to fetch audio");
				objectUrlRef.current = URL.createObjectURL(await response.blob());
				audio.src = objectUrlRef.current;
			} catch {
				setIsLoading(false);
				return;
			}
			setIsLoading(false);
		}

		audio.play().catch(() => setIsPlaying(false));
	}

	return {
		audioRef,
		isPlaying,
		isLoading,
		togglePlay,
		onPlay: () => setIsPlaying(true),
		onPause: () => setIsPlaying(false),
		onEnded: () => setIsPlaying(false),
	};
}
