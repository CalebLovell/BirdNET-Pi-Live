import {
	createFileRoute,
	Link,
	stripSearchParams,
} from "@tanstack/react-router";
import Fuse from "fuse.js";
import {
	ArrowDownAZ,
	ArrowUpDown,
	BarChart3,
	Binoculars,
	Bird,
	BookOpen,
	Clock,
	Loader2,
	Pause,
	Play,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { z } from "zod";

import { Button } from "~/components/ui/button.tsx";
import { Input } from "~/components/ui/input.tsx";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "~/components/ui/pagination.tsx";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group.tsx";
import { getLifeListCards, type LifeListCard } from "~/lib/detections.ts";
import { sciNameToSlug } from "~/lib/species-slug.ts";
import { usePlayableAudio } from "~/lib/use-playable-audio.ts";

const SORT_KEYS = ["count", "recent", "alpha"] as const;
type SortKey = (typeof SORT_KEYS)[number];

const DEFAULT_SEARCH = {
	q: "",
	sort: "count" as SortKey,
	reverse: false,
	page: 1,
};

// Search/sort/page all live in the URL (not component state), so filtering
// is shareable/bookmarkable and survives back/forward navigation.
const speciesSearchSchema = z.object({
	q: z.string().default(DEFAULT_SEARCH.q).catch(DEFAULT_SEARCH.q),
	sort: z
		.enum(SORT_KEYS)
		.default(DEFAULT_SEARCH.sort)
		.catch(DEFAULT_SEARCH.sort),
	reverse: z
		.boolean()
		.default(DEFAULT_SEARCH.reverse)
		.catch(DEFAULT_SEARCH.reverse),
	page: z
		.number()
		.int()
		.min(1)
		.default(DEFAULT_SEARCH.page)
		.catch(DEFAULT_SEARCH.page),
});

export const Route = createFileRoute("/species/")({
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
	const { q: search, sort, reverse, page } = Route.useSearch();
	const navigate = Route.useNavigate();

	// Local state keeps typing responsive; the URL (and the Fuse search it
	// drives) only updates after a short debounce, so back/forward history
	// doesn't get a new entry on every keystroke.
	const [queryInput, setQueryInput] = useState(search);
	useEffect(() => setQueryInput(search), [search]);

	const debouncedSetQuery = useDebouncedCallback((value: string) => {
		navigate({ search: (prev) => ({ ...prev, q: value, page: 1 }) });
	}, 200);

	const fuse = useMemo(
		() =>
			new Fuse(cards, {
				keys: ["comName", "sciName"],
				threshold: 0.2,
				ignoreLocation: true,
			}),
		[cards],
	);

	const filtered = useMemo(() => {
		const query = search.trim();
		const matches = query ? fuse.search(query).map((r) => r.item) : cards;

		const direction = reverse ? -1 : 1;
		return [...matches].sort((a, b) => {
			if (sort === "alpha")
				return direction * a.comName.localeCompare(b.comName);
			if (sort === "recent")
				return direction * b.lastDetected.localeCompare(a.lastDetected);
			return direction * (b.allTimeCount - a.allTimeCount);
		});
	}, [cards, fuse, search, sort, reverse]);

	const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
	const currentPage = Math.min(page, pageCount);
	const pageItems = filtered.slice(
		(currentPage - 1) * PAGE_SIZE,
		currentPage * PAGE_SIZE,
	);

	return (
		<div className="page-wrap py-4">
			<h1 className="display-title text-3xl font-semibold">Species</h1>
			<p className="mt-4 text-muted-foreground">
				{cards.length} species detected so far.
			</p>

			<div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<Input
					placeholder="Search species..."
					value={queryInput}
					onChange={(e) => {
						const value = e.target.value;
						setQueryInput(value);
						debouncedSetQuery(value);
					}}
					className="sm:max-w-sm"
				/>
				<div className="flex items-center gap-2">
					<ToggleGroup
						type="single"
						variant="outline"
						value={sort}
						onValueChange={(value) => {
							if (!value) return;
							navigate({
								search: (prev) => ({
									...prev,
									sort: value as SortKey,
									reverse: false,
									page: 1,
								}),
							});
						}}
					>
						<ToggleGroupItem value="count">
							<BarChart3 className="size-4" />
							Total
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
					<Button
						variant={reverse ? "default" : "outline"}
						size="icon"
						aria-label={
							reverse ? "Reverse sort order (on)" : "Default sort order"
						}
						aria-pressed={reverse}
						onClick={() =>
							navigate({
								search: (prev) => ({
									...prev,
									reverse: !prev.reverse,
									page: 1,
								}),
							})
						}
					>
						<ArrowUpDown className="size-4" />
					</Button>
				</div>
			</div>

			{pageItems.length === 0 ? (
				<p className="mt-4 text-muted-foreground">
					No species match &ldquo;{search}&rdquo;
				</p>
			) : (
				<div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
					{pageItems.map((card) => (
						<SpeciesCard key={card.comName} card={card} />
					))}
				</div>
			)}

			{pageCount > 1 && (
				<Pagination className="mt-4">
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
	const {
		audioRef,
		isPlaying,
		isLoading,
		togglePlay,
		onPlay,
		onPause,
		onEnded,
	} = usePlayableAudio(card.audioUrl);

	return (
		<div className="feature-card feature-card-link relative flex flex-col overflow-hidden rounded-md">
			<Link
				to="/species/$sciName"
				params={{ sciName: sciNameToSlug(card.sciName) }}
				className="absolute inset-0 z-0"
				aria-label={`View ${card.comName}`}
			/>
			<div className="p-3 pb-0">
				<h2 className="display-title text-lg font-bold">{card.comName}</h2>
				<p className="text-sm text-muted-foreground italic">{card.sciName}</p>
			</div>

			<div className="mt-2 flex h-40 w-full items-center justify-center overflow-hidden">
				{card.imageUrl ? (
					<img
						src={card.imageUrl}
						alt={card.comName}
						className="max-h-full max-w-40 object-contain"
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

				<div className="relative z-10 mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
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
							onPlay={onPlay}
							onPause={onPause}
							onEnded={onEnded}
						>
							<track kind="captions" />
						</audio>
					)}
				</div>
			</div>
		</div>
	);
}
