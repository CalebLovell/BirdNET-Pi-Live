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
 * The desktop sidebar: a white column flush to the viewport's left edge,
 * running the full height of the window.
 *
 * `sticky` rather than `fixed` deliberately -- staying in normal flow means the
 * main column needs no matching left offset, so the two can never disagree
 * about the sidebar's width. Its own `overflow-y` keeps the station block
 * reachable when the viewport is shorter than the nav.
 */
export function SiteSidebar() {
	return (
		<aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-[var(--line)] border-r bg-[var(--paper-raised)] lg:block">
			<SidebarBody />
		</aside>
	);
}
