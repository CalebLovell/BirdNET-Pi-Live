import {
	createFileRoute,
	Link,
	stripSearchParams,
} from "@tanstack/react-router";
import Fuse from "fuse.js";
import {
	ArrowDownAZ,
	BarChart3,
	Bird,
	ChevronDown,
	ChevronUp,
	Clock,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { z } from "zod";
import { PageHeaderCard } from "~/components/page-header-card.tsx";
import { SpeciesActions } from "~/components/species-actions.tsx";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "~/components/ui/pagination.tsx";
import { SearchInput } from "~/components/ui/search-input.tsx";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group.tsx";
import { getLifeListCards, type LifeListCard } from "~/lib/detections.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";

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

function parseDetected(value: string): Date | null {
	if (!value) return null;
	const parsed = new Date(value.replace(" ", "T"));
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatSpeciesDate(value: string): string {
	const parsed = parseDetected(value);
	if (!parsed) return value;
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
	}).format(parsed);
}

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
		navigate({
			search: (prev) => ({ ...prev, q: value, page: 1 }),
			replace: true,
		});
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

	// Derived from `filtered` rather than the page slice, so the figures
	// describe the whole search result, not just the 24 cards on screen.
	const stats = useMemo(() => {
		const isSearching = search.trim().length > 0;
		const recordings = filtered.reduce(
			(sum, card) => sum + card.allTimeCount,
			0,
		);
		const mostRecent = filtered.reduce(
			(latest, card) =>
				card.lastDetected > latest ? card.lastDetected : latest,
			"",
		);

		return [
			{
				label: "Species",
				value: filtered.length,
				detail: isSearching ? `of ${cards.length} recorded` : undefined,
			},
			{ label: "Total recordings", value: recordings },
			{
				label: "Most recently heard",
				value: mostRecent ? formatSpeciesDate(mostRecent) : "—",
			},
		];
	}, [cards.length, filtered, search]);

	const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
	const currentPage = Math.min(page, pageCount);
	const pageItems = filtered.slice(
		(currentPage - 1) * PAGE_SIZE,
		currentPage * PAGE_SIZE,
	);

	return (
		<div className="page-wrap space-y-4 py-4">
			<PageHeaderCard
				title="Species"
				description="Every species ever recorded at this station."
				stats={stats}
			/>

			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<SearchInput
					aria-label="Filter by species"
					placeholder="Search species..."
					value={queryInput}
					onChange={(e) => {
						const value = e.target.value;
						setQueryInput(value);
						debouncedSetQuery(value);
					}}
					onClear={() => {
						setQueryInput("");
						debouncedSetQuery.cancel();
						navigate({
							search: (prev) => ({ ...prev, q: "", page: 1 }),
							replace: true,
						});
					}}
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
									replace: true,
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
								replace: true,
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
				<p className="text-muted-foreground">
					No species match &ldquo;{search}&rdquo;
				</p>
			) : (
				<div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
					{pageItems.map((card) => (
						<SpeciesCard key={card.comName} card={card} />
					))}
				</div>
			)}

			{pageCount > 1 && (
				<Pagination>
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
										replace: true,
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
										navigate({
											search: (prev) => ({ ...prev, page: p }),
											replace: true,
										});
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
										replace: true,
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
	const parsedLastDetected = parseDetected(card.lastDetected);
	const lastHeard = parsedLastDetected
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
				to="/species/$comName"
				params={{ comName: comNameToSlug(card.comName) }}
				className="absolute inset-0 z-0"
				aria-label={`View ${card.comName}`}
			/>
			<div className="flex flex-col gap-1">
				<div className="flex items-baseline gap-1">
					<div className="tabular-data font-semibold text-foreground text-lg leading-none">
						{card.allTimeCount}
					</div>
					<div className="text-[10px] text-muted-foreground/70 leading-none">
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
					<h2 className="display-title font-bold text-base">{card.comName}</h2>
					<p className="text-[var(--bark)] text-xs italic">{card.sciName}</p>
				</div>
				<SpeciesActions
					audioUrl={card.audioUrl}
					ebirdUrl={card.ebirdUrl}
					comName={card.comName}
				/>
				<div className="w-full self-end text-right text-[10px] text-muted-foreground/70 leading-none">
					Last heard · {lastHeard}
				</div>
			</div>
		</div>
	);
}
