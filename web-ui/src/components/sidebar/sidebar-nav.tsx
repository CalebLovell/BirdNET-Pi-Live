import { Link } from "@tanstack/react-router";
import {
	Bird,
	CalendarDays,
	ChartColumn,
	CheckCheck,
	GraduationCap,
	ListTree,
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

	return (
		<nav className="flex flex-col gap-0.5 px-2">
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
				to="/species-control"
				search={{ page: 1, sort: "species", direction: "asc" }}
				activeOptions={{ includeSearch: false }}
				{...linkProps}
			>
				<SlidersHorizontal className="sidebar-icon" aria-hidden="true" />
				Control
			</Link>
			<Link
				to="/detections"
				search={{ page: 1, pageSize: 50, sort: "recorded", direction: "desc" }}
				activeOptions={{ includeSearch: false }}
				{...linkProps}
			>
				<ListTree className="sidebar-icon" aria-hidden="true" />
				Detections
			</Link>
			<Link
				to="/review"
				search={{ limit: 20 }}
				activeOptions={{ includeSearch: false }}
				{...linkProps}
			>
				<CheckCheck className="sidebar-icon" aria-hidden="true" />
				Review
			</Link>
			<Link to="/learn" {...linkProps}>
				<GraduationCap className="sidebar-icon" aria-hidden="true" />
				Learn
			</Link>
			<Link to="/stats" {...linkProps}>
				<ChartColumn className="sidebar-icon" aria-hidden="true" />
				Stats
			</Link>
			<Link to="/settings" {...linkProps}>
				<Settings className="sidebar-icon" aria-hidden="true" />
				Settings
			</Link>
		</nav>
	);
}
