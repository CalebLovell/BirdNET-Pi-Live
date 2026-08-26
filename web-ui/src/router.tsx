import {
	createRouter as createTanStackRouter,
	parseSearchWith,
	stringifySearchWith,
} from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const router = createTanStackRouter({
		routeTree,
		// The default stringifier is `stringifySearchWith(JSON.stringify, JSON.parse)`,
		// and that second argument is what quotes a string whose text happens to
		// be valid JSON -- so a year anchor went out as `?date=%222026%22`. Dropping
		// the parser leaves strings alone; everything else still serializes as JSON,
		// so numbers, booleans and objects are unchanged.
		//
		// Parsing stays JSON, which means `?date=2026` now comes back as the number
		// 2026. Every search schema that can receive a numeric-looking string
		// coerces (`z.coerce.string()`) or stringifies by hand, which is what makes
		// the round trip safe.
		stringifySearch: stringifySearchWith(JSON.stringify),
		parseSearch: parseSearchWith(JSON.parse),
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
	});

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
