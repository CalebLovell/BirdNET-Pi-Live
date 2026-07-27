import { ExternalLink, Loader2, Pause, Volume2 } from "lucide-react";

import { Button } from "~/components/ui/button.tsx";
import { usePlayableAudio } from "~/lib/use-playable-audio.ts";

type SpeciesActionsProps = {
	audioUrl?: string | null;
	ebirdUrl: string;
	comName: string;
};

function SpeciesActions({ audioUrl, ebirdUrl, comName }: SpeciesActionsProps) {
	const {
		audioRef,
		isPlaying,
		isLoading,
		togglePlay,
		onPlay,
		onPause,
		onEnded,
	} = usePlayableAudio(audioUrl ?? null);

	return (
		<div
			className={
				audioUrl !== undefined
					? "relative z-10 flex w-full flex-wrap items-center justify-between gap-2"
					: "relative z-10 flex flex-wrap items-center gap-2"
			}
		>
			{audioUrl !== undefined && (
				<Button
					variant="default"
					size="xs"
					className="gap-1.5 px-2.5 text-[11px] has-[>svg]:px-2.5"
					disabled={!audioUrl || isLoading}
					onClick={togglePlay}
					aria-label={
						isPlaying ? `Pause ${comName} sound` : `Play ${comName} sound`
					}
				>
					{isLoading ? (
						<Loader2 className="size-3 animate-spin" />
					) : isPlaying ? (
						<Pause className="size-3" />
					) : (
						<Volume2 className="size-3" />
					)}
					{isPlaying ? "Pause" : "Bird Call"}
				</Button>
			)}
			<Button
				variant="outline"
				size="xs"
				className="gap-1.5 px-2.5 text-[11px] has-[>svg]:px-2.5"
				asChild
			>
				<a
					href={ebirdUrl}
					target="_blank"
					rel="noreferrer"
					aria-label={`${comName} on eBird`}
				>
					<ExternalLink className="size-3" />
					eBird
				</a>
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
		</div>
	);
}

export { SpeciesActions };
