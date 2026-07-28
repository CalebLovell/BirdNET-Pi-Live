import { Link } from "@tanstack/react-router";

export function Header() {
	return (
		<header style={{ background: "var(--header-bg)" }}>
			<div className="page-wrap flex h-16 items-center justify-between border-b">
				<Link to="/" className="display-title font-semibold text-xl">
					BirdNET-Pi Live
				</Link>
				<nav className="flex items-center gap-4">
					<Link
						to="/today"
						className="nav-link"
						activeProps={{ className: "nav-link is-active" }}
					>
						Today
					</Link>
					<Link
						to="/timeline"
						className="nav-link"
						activeProps={{ className: "nav-link is-active" }}
					>
						Timeline
					</Link>
					<Link
						to="/species"
						className="nav-link"
						activeProps={{ className: "nav-link is-active" }}
					>
						Species
					</Link>
					<Link
						to="/detections"
						search={{
							page: 1,
							pageSize: 50,
							sort: "recorded",
							direction: "desc",
						}}
						className="nav-link"
						// Without this the link only reads as active while the URL's
						// search params still match the defaults above, so paging or
						// sorting drops the underline.
						activeOptions={{ includeSearch: false }}
						activeProps={{ className: "nav-link is-active" }}
					>
						Detections
					</Link>
					<Link
						to="/review"
						search={{ queue: "rare", limit: 20 }}
						className="nav-link"
						activeOptions={{ includeSearch: false }}
						activeProps={{ className: "nav-link is-active" }}
					>
						Review
					</Link>
					<Link
						to="/learn"
						className="nav-link"
						activeProps={{ className: "nav-link is-active" }}
					>
						Learn
					</Link>
					<Link
						to="/stats"
						className="nav-link"
						activeProps={{ className: "nav-link is-active" }}
					>
						Stats
					</Link>
				</nav>
			</div>
		</header>
	);
}
