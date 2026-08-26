import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old address for the live view, kept so bookmarks and anything already
 * linking here still land somewhere. The page was renamed for what it is:
 * a monitor of what the station is hearing now, not one more window onto its
 * history -- everything scoped to a day, a week or all of it moved to
 * `/activity`.
 */
export const Route = createFileRoute("/today")({
	beforeLoad: () => {
		throw redirect({ to: "/live", replace: true });
	},
});
