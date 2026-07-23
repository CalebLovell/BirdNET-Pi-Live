import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import {
	ArrowDownAZ,
	BarChart3,
	Binoculars,
	Bird,
	BookOpen,
	Clock,
	Loader2,
	Pause,
	Play,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { Button } from "#/components/ui/button.tsx";
import { Input } from "#/components/ui/input.tsx";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "#/components/ui/pagination.tsx";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group.tsx";
import { getLifeListCards, type LifeListCard } from "#/lib/detections.ts";

const SORT_KEYS = ["count", "recent", "alpha"] as const;
type SortKey = (typeof SORT_KEYS)[number];

const DEFAULT_SEARCH = { q: "", sort: "count" as SortKey, page: 1 };

// Search/sort/page all live in the URL (not component state), so filtering
// is shareable/bookmarkable and survives back/forward navigation.
const speciesSearchSchema = z.object({
	q: z.string().default(DEFAULT_SEARCH.q).catch(DEFAULT_SEARCH.q),
	sort: z
		.enum(SORT_KEYS)
		.default(DEFAULT_SEARCH.sort)
		.catch(DEFAULT_SEARCH.sort),
	page: z
		.number()
		.int()
		.min(1)
		.default(DEFAULT_SEARCH.page)
		.catch(DEFAULT_SEARCH.page),
});

export const Route = createFileRoute("/species")({
	validateSearch: speciesSearchSchema,
	search: {
		middlewares: [stripSearchParams(DEFAULT_SEARCH)],
	},
	component: Species,
	loader: () => getLifeListCards(),
});

const PAGE_SIZE = 24;

function Species() {
	const cards = Route.useLoaderData();
	const { q: search, sort, page } = Route.useSearch();
	const navigate = Route.useNavigate();

	const filtered = useMemo(() => {
		const query = search.trim().toLowerCase();
		const matches = query
			? cards.filter(
					(c) =>
						c.comName.toLowerCase().includes(query) ||
						c.sciName.toLowerCase().includes(query),
				)
			: cards;

		return [...matches].sort((a, b) => {
			if (sort === "alpha") return a.comName.localeCompare(b.comName);
			if (sort === "recent")
				return b.lastDetected.localeCompare(a.lastDetected);
			return b.allTimeCount - a.allTimeCount;
		});
	}, [cards, search, sort]);

	const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
	const currentPage = Math.min(page, pageCount);
	const pageItems = filtered.slice(
		(currentPage - 1) * PAGE_SIZE,
		currentPage * PAGE_SIZE,
	);

	return (
		<div className="page-wrap py-8">
			<h1 className="display-title text-3xl font-semibold">Species</h1>
			<p className="mt-2 text-muted-foreground">
				{cards.length} species detected so far.
			</p>

			<div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<ToggleGroup
					type="single"
					variant="outline"
					value={sort}
					onValueChange={(value) => {
						if (!value) return;
						navigate({
							search: (prev) => ({ ...prev, sort: value as SortKey, page: 1 }),
						});
					}}
				>
					<ToggleGroupItem value="count">
						<BarChart3 className="size-4" />
						Most
					</ToggleGroupItem>
					<ToggleGroupItem value="recent">
						<Clock className="size-4" />
						Recent
					</ToggleGroupItem>
					<ToggleGroupItem value="alpha">
						<ArrowDownAZ className="size-4" />
						Alphabetical
					</ToggleGroupItem>
				</ToggleGroup>
				<Input
					placeholder="Search species..."
					value={search}
					onChange={(e) => {
						const value = e.target.value;
						navigate({ search: (prev) => ({ ...prev, q: value, page: 1 }) });
					}}
					className="sm:max-w-xs"
				/>
			</div>

			{pageItems.length === 0 ? (
				<p className="mt-10 text-muted-foreground">
					No species match &ldquo;{search}&rdquo;.
				</p>
			) : (
				<div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-[22px]">
					{pageItems.map((card) => (
						<SpeciesCard key={card.comName} card={card} />
					))}
				</div>
			)}

			{pageCount > 1 && (
				<Pagination className="mt-8">
					<PaginationContent>
						<PaginationItem>
							<PaginationPrevious
								href="#"
								onClick={(e) => {
									e.preventDefault();
									navigate({
										search: (prev) => ({
											...prev,
											page: Math.max(1, currentPage - 1),
										}),
									});
								}}
								className={
									currentPage === 1 ? "pointer-events-none opacity-50" : ""
								}
							/>
						</PaginationItem>
						{Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
							<PaginationItem key={p}>
								<PaginationLink
									href="#"
									isActive={p === currentPage}
									onClick={(e) => {
										e.preventDefault();
										navigate({ search: (prev) => ({ ...prev, page: p }) });
									}}
								>
									{p}
								</PaginationLink>
							</PaginationItem>
						))}
						<PaginationItem>
							<PaginationNext
								href="#"
								onClick={(e) => {
									e.preventDefault();
									navigate({
										search: (prev) => ({
											...prev,
											page: Math.min(pageCount, currentPage + 1),
										}),
									});
								}}
								className={
									currentPage === pageCount
										? "pointer-events-none opacity-50"
										: ""
								}
							/>
						</PaginationItem>
					</PaginationContent>
				</Pagination>
			)}
		</div>
	);
}

function SpeciesCard({ card }: { card: LifeListCard }) {
	const audioRef = useRef<HTMLAudioElement>(null);
	const objectUrlRef = useRef<string | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		return () => {
			if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
		};
	}, []);

	async function togglePlay() {
		const audio = audioRef.current;
		if (!audio || !card.audioUrl) return;

		if (isPlaying) {
			audio.pause();
			return;
		}

		// The browser's native <audio src> loading doesn't reliably reach
		// this app's dynamic audio route (some Sec-Fetch-Dest-specific
		// behavior in this dev stack), but a plain fetch() always does --
		// so fetch it ourselves and play from a local blob instead.
		if (!objectUrlRef.current) {
			setIsLoading(true);
			try {
				const response = await fetch(card.audioUrl);
				if (!response.ok) throw new Error("Failed to fetch audio");
				objectUrlRef.current = URL.createObjectURL(await response.blob());
				audio.src = objectUrlRef.current;
			} catch {
				setIsLoading(false);
				return;
			}
			setIsLoading(false);
		}

		audio.play().catch(() => setIsPlaying(false));
	}

	return (
		<div className="feature-card flex flex-col overflow-hidden rounded-lg">
			<div className="p-3 pb-0">
				<h2 className="display-title text-lg font-bold">{card.comName}</h2>
				<p className="text-sm text-muted-foreground italic">{card.sciName}</p>
			</div>

			<div className="mt-2 flex h-40 w-full items-center justify-center overflow-hidden">
				{card.imageUrl ? (
					<img
						src={card.imageUrl}
						alt={card.comName}
						className="max-h-full max-w-[160px] object-contain"
						loading="lazy"
					/>
				) : (
					<div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
						<Bird className="size-12" />
					</div>
				)}
			</div>

			<div className="flex flex-1 flex-col gap-2 p-3">
				<div className="flex gap-5 text-sm">
					<div>
						<div className="tabular-data font-semibold">{card.hourCount}</div>
						<div className="text-xs text-muted-foreground">This hour</div>
					</div>
					<div>
						<div className="tabular-data font-semibold">
							{card.allTimeCount}
						</div>
						<div className="text-xs text-muted-foreground">All time</div>
					</div>
				</div>

				<div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
					<Button
						variant="default"
						size="xs"
						disabled={!card.audioUrl || isLoading}
						onClick={togglePlay}
						aria-label={
							isPlaying
								? `Pause ${card.comName} call`
								: `Play ${card.comName} call`
						}
					>
						{isLoading ? (
							<Loader2 className="size-3 animate-spin" />
						) : isPlaying ? (
							<Pause className="size-3" />
						) : (
							<Play className="size-3" />
						)}
						{isPlaying ? "Pause" : "Play"}
					</Button>
					<div className="flex items-center gap-2">
						<Button variant="outline" size="xs" asChild>
							<a
								href={card.wikipediaUrl}
								target="_blank"
								rel="noreferrer"
								aria-label={`${card.comName} on Wikipedia`}
							>
								<BookOpen className="size-3" />
								Wiki
							</a>
						</Button>
						<Button variant="outline" size="xs" asChild>
							<a
								href={card.ebirdUrl}
								target="_blank"
								rel="noreferrer"
								aria-label={`${card.comName} on eBird`}
							>
								<Binoculars className="size-3" />
								eBird
							</a>
						</Button>
					</div>
					{card.audioUrl && (
						<audio
							ref={audioRef}
							preload="none"
							onPlay={() => setIsPlaying(true)}
							onPause={() => setIsPlaying(false)}
							onEnded={() => setIsPlaying(false)}
						>
							<track kind="captions" />
						</audio>
					)}
				</div>
			</div>
		</div>
	);
}
