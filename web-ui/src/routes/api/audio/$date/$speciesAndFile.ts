import { readFile } from "node:fs/promises";
import { createFileRoute } from "@tanstack/react-router";
import { mimeTypeFor, resolveExtractedFile } from "#/lib/audio.server.ts";
import { splitSpeciesAndFile } from "#/lib/audio.ts";

export const Route = createFileRoute("/api/audio/$date/$speciesAndFile")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const [species, file] = splitSpeciesAndFile(params.speciesAndFile);
				const relativePath = `By_Date/${params.date}/${species}/${file}`;
				const resolved = resolveExtractedFile(relativePath);
				if (!resolved) {
					return new Response("Not found", { status: 404 });
				}

				try {
					const data = await readFile(resolved);
					return new Response(data, {
						headers: {
							"Content-Type": mimeTypeFor(resolved),
							"Cache-Control": "public, max-age=31536000, immutable",
						},
					});
				} catch {
					return new Response("Not found", { status: 404 });
				}
			},
		},
	},
});
