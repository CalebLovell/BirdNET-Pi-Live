import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Folded into `/timeline` under the "All time" period, which is what this page
 * always was: the same figures every other window shows, with the scope taken
 * away.
 *
 * A `?year=` link is the one exception. That parameter chose a year for the
 * by-month chart, and the timeline page has a period for exactly that -- so
 * the year becomes the window rather than being dropped.
 */
export const Route = createFileRoute("/stats")({
	validateSearch: z.object({
		year: z.coerce.number().int().optional().catch(undefined),
	}),
	beforeLoad: ({ search }) => {
		throw redirect({
			to: "/timeline",
			search:
				search.year === undefined
					? { period: "all" as const }
					: { period: "year" as const, date: String(search.year) },
			replace: true,
		});
	},
});
