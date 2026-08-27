import "@tanstack/react-start/server-only";

/** BirdNET-Pi's `livestream.sh` publishes the mic/RTSP feed here by default. */
export const DEFAULT_LIVE_STREAM_URL = "http://localhost:8000/stream";

/**
 * The upstream MP3 the /api/live-stream route proxies. Overridable via
 * LIVE_STREAM_URL for stations whose Icecast lives elsewhere; a blank value is
 * treated as unset so an empty env line can't point the proxy at nothing.
 */
export function resolveLiveStreamUrl(
	env: NodeJS.ProcessEnv = process.env,
): string {
	const configured = env.LIVE_STREAM_URL?.trim();
	return configured ? configured : DEFAULT_LIVE_STREAM_URL;
}
