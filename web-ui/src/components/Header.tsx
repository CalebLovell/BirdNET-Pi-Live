import { Link } from "@tanstack/react-router";

import { ThemeToggle } from "#/components/ThemeToggle.tsx";

export function Header() {
	return (
		<header className="border-b" style={{ background: "var(--header-bg)" }}>
			<div className="page-wrap flex h-16 items-center justify-between">
				<Link to="/" className="display-title text-xl font-semibold">
					BirdNET-Pi Live
				</Link>
				<nav className="flex items-center gap-6">
					<Link
						to="/"
						className="nav-link"
						activeOptions={{ exact: true }}
						activeProps={{ className: "nav-link is-active" }}
					>
						Overview
					</Link>
					<Link
						to="/detections"
						className="nav-link"
						activeProps={{ className: "nav-link is-active" }}
					>
						Detections
					</Link>
					<Link
						to="/species"
						className="nav-link"
						activeProps={{ className: "nav-link is-active" }}
					>
						Species
					</Link>
					<ThemeToggle />
				</nav>
			</div>
		</header>
	);
}
