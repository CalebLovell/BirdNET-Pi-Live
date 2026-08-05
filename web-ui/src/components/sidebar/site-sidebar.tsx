import { Link } from "@tanstack/react-router";

import { SidebarNav } from "~/components/sidebar/sidebar-nav.tsx";
import { StationStatus } from "~/components/sidebar/station-status.tsx";

/**
 * Everything inside the sidebar, shared by the desktop column and the mobile
 * drawer so the two can never drift apart.
 */
export function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
	return (
		<div className="flex min-h-full flex-col py-4">
			<Link
				to="/"
				onClick={onNavigate}
				className="display-title px-4 pb-4 font-semibold text-xl no-underline"
			>
				Birdbook Pi
			</Link>

			<SidebarNav onNavigate={onNavigate} />

			<hr className="mx-4 my-4 border-0 border-[var(--line)] border-t" />

			<StationStatus />

			{/* Pushed to the bottom on a tall viewport, and simply last in the flow
			    on a short one -- `mt-auto` does both. */}
			<a
				href="https://github.com/kahst/BirdNET-Analyzer"
				className="nav-link mt-auto px-4 pt-4 text-[11px] text-muted-foreground"
			>
				Powered by BirdNET
			</a>
		</div>
	);
}

/**
 * The desktop sidebar: a card in the same family as the page's content cards,
 * inset from the viewport so paper shows to its left and above and below it.
 *
 * `sticky` rather than `fixed` deliberately -- staying in normal flow means the
 * main column needs no matching left offset, so the two can never disagree
 * about the sidebar's width.
 *
 * The inset lives on the `aside` and the scrolling on the card inside it: a
 * single element can't both be the sticky full-height box and the padded card
 * without the padding scrolling away with the content. `h-full` then makes the
 * card exactly a viewport minus the inset, so the station block stays reachable
 * on a short window.
 */
export function SiteSidebar() {
	return (
		<aside className="sticky top-0 hidden h-screen shrink-0 py-4 pl-4 lg:block">
			<div className="feature-card h-full w-64 overflow-y-auto rounded-md">
				<SidebarBody />
			</div>
		</aside>
	);
}
