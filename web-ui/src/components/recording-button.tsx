import { Pause, Volume2 } from "lucide-react";

import { Button } from "~/components/ui/button.tsx";
import { usePlayableAudio } from "~/lib/use-playable-audio.ts";

/**
 * Plays a single detection's extracted clip. The label stays fixed while the
 * icon carries play/pause state, so the button holds its width mid-playback.
 * `iconOnly` drops the label for tight rows; the accessible name comes from
 * aria-label either way.
 */
export function RecordingButton({
	audioUrl,
	iconOnly = false,
}: {
	audioUrl: string | null;
	iconOnly?: boolean;
}) {
	const {
		audioRef,
		isPlaying,
		isLoading,
		togglePlay,
		onPlay,
		onPause,
		onEnded,
	} = usePlayableAudio(audioUrl);

	return (
		<>
			<Button
				variant="outline"
				size={iconOnly ? "icon-xs" : "xs"}
				className="shrink-0"
				icon={isPlaying ? Pause : Volume2}
				loading={isLoading}
				disabled={!audioUrl}
				onClick={togglePlay}
				aria-label={isPlaying ? "Pause bird call" : "Play bird call"}
			>
				{iconOnly ? null : "Bird Call"}
			</Button>
			{audioUrl && (
				<audio
					ref={audioRef}
					preload="none"
					onPlay={onPlay}
					onPause={onPause}
					onEnded={onEnded}
				>
					<track kind="captions" />
				</audio>
			)}
		</>
	);
}
