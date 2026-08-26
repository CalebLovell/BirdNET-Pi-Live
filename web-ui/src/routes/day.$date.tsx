import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Folded into `/timeline` as its Daily period. The day review used to be
 * reachable only by clicking a date inside a table -- a page with no way back
 * out to a wider window. It is now one setting of the period control, so the
 * same click lands somewhere you can zoom out from.
 */
export const Route = createFileRoute("/day/$date")({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/timeline",
			search: { period: "day" as const, date: params.date },
			replace: true,
		});
	},
});
