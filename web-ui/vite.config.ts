import tailwindcss from "@tailwindcss/vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const config = defineConfig({
	// PORT lets a harness hand the dev server a free port when 3000 is taken;
	// plain `npm run dev` still lands on 3000, which is what the launch config
	// and every bookmarked localhost URL expect.
	server: { port: Number(process.env.PORT) || 3000 },
	resolve: { tsconfigPaths: true },
	plugins: [
		nitro({ rollupConfig: { external: [/^@sentry\//] } }),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	],
});

export default config;
