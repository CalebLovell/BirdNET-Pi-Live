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
