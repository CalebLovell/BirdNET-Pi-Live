import { Link, useRouteContext } from "@tanstack/react-router";
import {
	Bird,
	CalendarDays,
	ChartColumn,
	CheckCheck,
	GraduationCap,
	ListTree,
	Lock,
	Settings,
	SlidersHorizontal,
	Sunrise,
} from "lucide-react";

/**
 * The site's nav, shared by the desktop sidebar and the mobile drawer.
 *
 * `onNavigate` lets the drawer close itself on a tap; the desktop sidebar
 * passes nothing, since it never needs dismissing.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
	const linkProps = {
		className: "sidebar-link",
		activeProps: { className: "sidebar-link is-active" },
		onClick: onNavigate,
	};

	const { auth } = useRouteContext({ from: "__root__" });
	// Gated pages stay listed rather than disappearing: a visitor should be able
	// to see the station has settings without being able to open them, and the
	// nav must not change shape when you unlock.
	const lock = auth.unlocked ? null : (
		<Lock
			className="ml-auto size-3 text-muted-foreground"
			aria-label="Locked"
			role="img"
		/>
	);

	return (
		<div className="flex flex-col gap-4 px-2">
			{/* Two labelled navs rather than one list: everything anyone can open sits up
			    top, and the three gated pages sit together at the bottom, so the
			    lock icons read as one section rather than as scattered exceptions. */}
			<nav
				className="flex flex-col gap-0.5"
				aria-labelledby="sidebar-group-explore"
			>
				<p
					id="sidebar-group-explore"
					className="island-kicker px-2.5 pb-1 text-[0.62rem]"
				>
					Explore
				</p>
				<Link to="/today" {...linkProps}>
					<Sunrise className="sidebar-icon" aria-hidden="true" />
					Today
				</Link>
				<Link to="/timeline" {...linkProps}>
					<CalendarDays className="sidebar-icon" aria-hidden="true" />
					Timeline
				</Link>
				<Link to="/species" {...linkProps}>
					<Bird className="sidebar-icon" aria-hidden="true" />
					Species
				</Link>
				{/* The search-bearing links keep their defaults and
				    `activeOptions={{ includeSearch: false }}`: without it the link stops
				    reading as active as soon as paging or sorting changes the URL. */}
				<Link
					to="/detections"
					search={{
						page: 1,
						pageSize: 50,
						sort: "recorded",
						direction: "desc",
					}}
					activeOptions={{ includeSearch: false }}
					{...linkProps}
				>
					<ListTree className="sidebar-icon" aria-hidden="true" />
					Detections
				</Link>
				<Link to="/stats" {...linkProps}>
					<ChartColumn className="sidebar-icon" aria-hidden="true" />
					Stats
				</Link>
				<Link to="/learn" {...linkProps}>
					<GraduationCap className="sidebar-icon" aria-hidden="true" />
					Learn
				</Link>
			</nav>

			<nav
				className="flex flex-col gap-0.5"
				aria-labelledby="sidebar-group-manage"
			>
				<p
					id="sidebar-group-manage"
					className="island-kicker px-2.5 pb-1 text-[0.62rem]"
				>
					Manage
				</p>
				<Link
					to="/review"
					search={{ limit: 20 }}
					activeOptions={{ includeSearch: false }}
					{...linkProps}
				>
					<CheckCheck className="sidebar-icon" aria-hidden="true" />
					Review
					{lock}
				</Link>
				<Link
					to="/species-control"
					search={{ page: 1, sort: "species", direction: "asc" }}
					activeOptions={{ includeSearch: false }}
					{...linkProps}
				>
					<SlidersHorizontal className="sidebar-icon" aria-hidden="true" />
					Control
					{lock}
				</Link>
				<Link to="/settings" {...linkProps}>
					<Settings className="sidebar-icon" aria-hidden="true" />
					Settings
					{lock}
				</Link>
			</nav>
		</div>
	);
}
