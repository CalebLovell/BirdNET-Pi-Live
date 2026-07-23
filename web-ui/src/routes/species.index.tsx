import {
	createFileRoute,
	Link,
	stripSearchParams,
} from "@tanstack/react-router";
import Fuse from "fuse.js";
import {
	ArrowDownAZ,
	BarChart3,
	Binoculars,
	Bird,
	ChevronDown,
	ChevronUp,
	Clock,
	Loader2,
	Pause,
	Volume2,
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
				return direction * b.comName.localeCompare(a.comName);
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
							if (!value) {
								navigate({
									search: (prev) => ({
										...prev,
										reverse: !prev.reverse,
										page: 1,
									}),
								});
								return;
							}
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
						<ToggleGroupItem
							value="count"
							aria-label={`Total sort (${sort === "count" && reverse ? "ascending" : "descending"})`}
						>
							<BarChart3 className="size-4" />
							Total
							{sort === "count" && reverse ? (
								<ChevronUp className="size-3" aria-hidden="true" />
							) : (
								<ChevronDown className="size-3" aria-hidden="true" />
							)}
						</ToggleGroupItem>
						<ToggleGroupItem
							value="recent"
							aria-label={`Recent sort (${sort === "recent" && reverse ? "ascending" : "descending"})`}
						>
							<Clock className="size-4" />
							Recent
							{sort === "recent" && reverse ? (
								<ChevronUp className="size-3" aria-hidden="true" />
							) : (
								<ChevronDown className="size-3" aria-hidden="true" />
							)}
						</ToggleGroupItem>
						<ToggleGroupItem
							value="alpha"
							aria-label={`Alphabetical sort (${sort === "alpha" && reverse ? "ascending" : "descending"})`}
						>
							<ArrowDownAZ className="size-4" />
							Alphabetical
							{sort === "alpha" && reverse ? (
								<ChevronUp className="size-3" aria-hidden="true" />
							) : (
								<ChevronDown className="size-3" aria-hidden="true" />
							)}
						</ToggleGroupItem>
					</ToggleGroup>
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

	const parsedLastDetected = card.lastDetected
		? new Date(card.lastDetected.replace(" ", "T"))
		: null;
	const lastHeard =
		parsedLastDetected && !Number.isNaN(parsedLastDetected.getTime())
			? new Intl.DateTimeFormat(undefined, {
					month: "short",
					day: "numeric",
					year: "numeric",
					hour: "numeric",
					minute: "2-digit",
				}).format(parsedLastDetected)
			: card.lastDetected || "—";

	return (
		<div className="feature-card feature-card-link relative flex flex-col gap-3 overflow-hidden rounded-md p-3">
			<Link
				to="/species/$sciName"
				params={{ sciName: sciNameToSlug(card.sciName) }}
				className="absolute inset-0 z-0"
				aria-label={`View ${card.comName}`}
			/>
			<div className="flex flex-col gap-1">
				<div className="flex items-baseline gap-1">
					<div className="tabular-data text-lg font-semibold leading-none text-foreground">
						{card.allTimeCount}
					</div>
					<div className="text-[10px] leading-none text-muted-foreground/70">
						total recordings
					</div>
				</div>
			</div>

			<div className="flex h-40 w-full items-center justify-center overflow-hidden">
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

			<div className="flex flex-1 flex-col gap-3">
				<div>
					<h2 className="display-title text-base font-bold">{card.comName}</h2>
					<p className="text-xs text-[var(--bark)] italic">{card.sciName}</p>
				</div>
				<div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
					<Button
						variant="default"
						size="xs"
						className="gap-1.5 px-2.5 text-[11px] has-[>svg]:px-2.5"
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
							<Volume2 className="size-3" />
						)}
						{isPlaying ? "Pause" : "Bird Call"}
					</Button>
					<div className="flex items-center gap-3">
						<Button
							variant="outline"
							size="xs"
							className="gap-1.5 px-2.5 text-[11px] has-[>svg]:px-2.5"
							asChild
						>
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
					<div className="w-full self-end text-right text-[10px] leading-none text-muted-foreground/70">
						Last heard · {lastHeard}
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
