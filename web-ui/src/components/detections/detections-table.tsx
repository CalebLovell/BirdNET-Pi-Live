import { Link } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	type OnChangeFn,
	type RowSelectionState,
	useReactTable,
} from "@tanstack/react-table";
import {
	ArrowDown,
	ArrowUp,
	ChevronLeft,
	ChevronRight,
	Pause,
	Volume2,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { ConfidencePill } from "~/components/confidence-pill.tsx";
import { Button } from "~/components/ui/button.tsx";
import { Input } from "~/components/ui/input.tsx";
import { SearchInput } from "~/components/ui/search-input.tsx";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table.tsx";
import { audioUrlFor } from "~/lib/audio.ts";
import {
	type DetectionWorkspaceSearch,
	type DetectionWorkspaceSort,
	detectionRowKey,
} from "~/lib/detection-workspace.ts";
import type { DetectionPage, DetectionTableRow } from "~/lib/detections.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";
import { usePlayableAudio } from "~/lib/use-playable-audio.ts";

type DetectionsTableProps = {
	page: DetectionPage;
	search: DetectionWorkspaceSearch;
	onSearchChange: (search: DetectionWorkspaceSearch) => void;
	rowSelection: RowSelectionState;
	onRowSelectionChange: OnChangeFn<RowSelectionState>;
};

type DetectionsFiltersProps = Pick<
	DetectionsTableProps,
	"search" | "onSearchChange"
>;

// Three tiers, each sized from what the content actually measures plus the 16px
// cell padding, and each dropping the least essential column left:
//
//   under 34rem  species, recorded, audio      -- min 26rem
//   34rem+       + confidence                  -- min 34rem
//   64rem+       + scientific name             -- min 62rem
//
// Container queries, not viewport breakpoints: the sidebar takes ~345px, so a
// 1280px window leaves the table barely 935px and a viewport-based rule would
// bring a column back into a space that cannot hold it.
//
// Widths live on the header cells rather than a <colgroup> because columns drop
// out: a display:none cell leaves the table, so the remaining <col> elements
// would slide onto the wrong columns. Class names are spelled out in full --
// Tailwind scans for literal strings, so a composed `${WIDE}:w-[4.2%]` would
// compile to nothing. Each tier's percentages sum to 100.
const HEADER_CLASSES: Record<string, string> = {
	select: "w-[7.2%] @min-[34rem]:w-[5.5%] @min-[64rem]:w-[4.2%]",
	species: "w-[44.1%] @min-[34rem]:w-[35%] @min-[64rem]:w-[24%]",
	recorded: "w-[38.2%] @min-[34rem]:w-[29.5%] @min-[64rem]:w-[22%]",
	scientificName: "hidden w-[24%] @min-[64rem]:table-cell",
	confidence:
		"hidden @min-[34rem]:table-cell @min-[34rem]:w-[22%] @min-[64rem]:w-[14%]",
	audio: "w-[10.5%] pr-0 text-right @min-[34rem]:w-[8%] @min-[64rem]:w-[11.8%]",
};
const CELL_CLASSES: Record<string, string> = {
	scientificName: "hidden @min-[64rem]:table-cell",
	confidence: "hidden @min-[34rem]:table-cell",
	audio: "pr-0",
};

function recordedLabel(row: DetectionTableRow): string {
	const date = new Date(`${row.Date}T${row.Time}`);
	if (Number.isNaN(date.valueOf())) return `${row.Date} ${row.Time}`;
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}

function RecordingButton({ row }: { row: DetectionTableRow }) {
	const audioUrl = audioUrlFor(row.Date, row.Com_Name, row.File_Name);
	const {
		audioRef,
		isLoading,
		isPlaying,
		onEnded,
		onPause,
		onPlay,
		togglePlay,
	} = usePlayableAudio(audioUrl);

	return (
		<>
			<Button
				aria-label={`${isPlaying ? "Pause" : "Play"} ${row.Com_Name} recording`}
				size="xs"
				variant="outline"
				icon={isPlaying ? Pause : Volume2}
				loading={isLoading}
				onClick={togglePlay}
			>
				{/* The word only returns in the widest tier, where the audio column is
				    11.8% (117px+) and can hold the 90px button -- below that it is 8%
				    and the label would burst the column. `hidden` takes the span out
				    of the flex flow so the button's gap collapses with it, and the
				    aria-label carries the full name either way. */}
				<span className="@min-[64rem]:inline hidden">Recording</span>
			</Button>
			<audio
				ref={audioRef}
				onEnded={onEnded}
				onPause={onPause}
				onPlay={onPlay}
			/>
		</>
	);
}

function SortButton({
	label,
	sort,
	search,
	onSort,
}: {
	label: string;
	sort: DetectionWorkspaceSort;
	search: DetectionWorkspaceSearch;
	onSort: (sort: DetectionWorkspaceSort) => void;
}) {
	const isActive = search.sort === sort;
	const Icon = isActive && search.direction === "asc" ? ArrowUp : ArrowDown;
	return (
		<button
			type="button"
			className="inline-flex items-center gap-1 hover:text-foreground"
			onClick={() => onSort(sort)}
		>
			{label}
			<Icon className={isActive ? "size-3.5" : "size-3.5 opacity-35"} />
		</button>
	);
}

// Label sits inline with the field to keep the filter row one line tall. The
// clear button is always rendered — disabled and dimmed with no date set — so
// the row never shifts.
function DateFilter({
	id,
	label,
	value,
	onChange,
}: {
	id: string;
	label: string;
	value: string;
	onChange: (value: string | undefined) => void;
}) {
	return (
		<div className="flex items-center gap-1.5">
			<label className="text-muted-foreground text-xs" htmlFor={id}>
				{label}
			</label>
			{/* 8rem leaves the 14px date text (72px) clear of the native picker
			    glyph and the gap now set on it in styles.css; at 7.5rem the year ran
			    into the calendar icon. */}
			<Input
				className="!w-32 @min-[38rem]:!w-36"
				id={id}
				type="date"
				value={value}
				onChange={(event) => onChange(event.target.value || undefined)}
			/>
			{/* The station's one button rather than a bare <button>: this was a
			    borderless glyph that read as decoration, and it missed the shared
			    hover, focus-visible ring and disabled treatment. `type` is explicit
			    because a <button> defaults to `submit`. Native buttons are already
			    in the tab order, so no tabIndex belongs here -- adding one would
			    only risk overriding it. */}
			{/* `icon-lg` is the 36px square that matches the field's h-9 exactly --
			    at icon-sm it sat 8px short and read as a different control. `title`
			    gives the pointer a tooltip; the aria-label stays longer because a
			    screen reader hears it out of context. */}
			<Button
				type="button"
				aria-label={`Clear ${label.toLowerCase()} date`}
				title="Clear"
				disabled={!value}
				icon={X}
				size="icon-lg"
				variant="outline"
				onClick={() => onChange(undefined)}
			/>
		</div>
	);
}

export function DetectionsFilters({
	search,
	onSearchChange,
}: DetectionsFiltersProps) {
	function updateSearch(change: Partial<DetectionWorkspaceSearch>) {
		onSearchChange({ ...search, ...change });
	}

	// Local state keeps typing responsive; the URL (and the Fuse search it
	// drives on the server) only updates after a short debounce.
	const [queryInput, setQueryInput] = useState(search.species ?? "");
	useEffect(() => setQueryInput(search.species ?? ""), [search.species]);

	const debouncedSetQuery = useDebouncedCallback((value: string) => {
		updateSearch({ page: 1, species: value || undefined });
	}, 200);

	return (
		// The container and the layout it drives cannot be the same element -- a
		// container query only sees descendants, so `@container` here and
		// `@min-[38rem]:flex-row` on the child.
		<div className="@container">
			{/* Stacked, the search and the dates are separate rows of the form and
			    take the page's own 4-unit rhythm; side by side they only need the
			    tighter 3 that separates neighbours in a row. */}
			<div className="flex @min-[38rem]:flex-row flex-col @min-[38rem]:items-center @min-[38rem]:justify-between @min-[38rem]:gap-3 gap-4">
				<SearchInput
					aria-label="Search detections"
					placeholder="Search detections..."
					value={queryInput}
					onChange={(event) => {
						const value = event.target.value;
						setQueryInput(value);
						debouncedSetQuery(value);
					}}
					onClear={() => {
						setQueryInput("");
						debouncedSetQuery.cancel();
						updateSearch({ page: 1, species: undefined });
					}}
				/>
				{/* `flex-wrap` is the safety net, not the plan: at the compact field
			    width the pair needs ~368px and fits one line on a 414px phone. It
			    only wraps below that, and `shrink-0` keeps them legible rather than
			    squeezing the date text out of its box. */}
				{/* Stacked, the group is a full-width flex item and would sit hard
				    left; `self-end` pulls it to the right edge so it stays where the
				    row layout puts it. `self-auto` hands alignment back to the row's
				    `items-center` above 38rem -- left as `self-end` it would align on
				    the cross axis there and drop the dates to the row's bottom.
				    `justify-end` keeps both filters right when they wrap to two
				    lines. */}
				<div className="flex shrink-0 flex-wrap items-center justify-end gap-2 @min-[38rem]:self-auto self-end">
					<DateFilter
						id="detections-from"
						label="From"
						value={search.from ?? ""}
						onChange={(from) => updateSearch({ page: 1, from })}
					/>
					<DateFilter
						id="detections-to"
						label="To"
						value={search.to ?? ""}
						onChange={(to) => updateSearch({ page: 1, to })}
					/>
				</div>
			</div>
		</div>
	);
}

export function DetectionsTable({
	page,
	search,
	onSearchChange,
	rowSelection,
	onRowSelectionChange,
}: DetectionsTableProps) {
	function updateSearch(change: Partial<DetectionWorkspaceSearch>) {
		onSearchChange({ ...search, ...change });
		onRowSelectionChange({});
	}

	function sortBy(sort: DetectionWorkspaceSort) {
		updateSearch({
			page: 1,
			sort,
			direction:
				search.sort === sort && search.direction === "desc" ? "asc" : "desc",
		});
	}

	const columns: ColumnDef<DetectionTableRow>[] = [
		{
			id: "select",
			header: ({ table }) => (
				<input
					aria-label="Select all detections on this page"
					checked={table.getIsAllPageRowsSelected()}
					className="block size-3.5 accent-[var(--moss)]"
					type="checkbox"
					onChange={table.getToggleAllPageRowsSelectedHandler()}
				/>
			),
			cell: ({ row }) => (
				<input
					aria-label={`Select ${row.original.Com_Name}`}
					checked={row.getIsSelected()}
					className="block size-3.5 accent-[var(--moss)]"
					type="checkbox"
					onChange={row.getToggleSelectedHandler()}
				/>
			),
			enableHiding: false,
		},
		{
			accessorKey: "Com_Name",
			id: "species",
			header: () => (
				<SortButton
					label="Species"
					sort="species"
					search={search}
					onSort={sortBy}
				/>
			),
			// Styled to match the species name in the stats page's top-species rows,
			// hover underline included, so a species link reads the same everywhere.
			cell: ({ row }) => (
				<Link
					to="/species/$comName"
					params={{ comName: comNameToSlug(row.original.Com_Name) }}
					className="font-medium no-underline hover:underline"
				>
					{row.original.Com_Name}
				</Link>
			),
		},
		{
			id: "recorded",
			header: () => (
				<SortButton
					label="Recorded"
					sort="recorded"
					search={search}
					onSort={sortBy}
				/>
			),
			cell: ({ row }) => (
				<Link
					to="/day/$date"
					params={{ date: row.original.Date }}
					className="tabular-data text-sm no-underline hover:underline"
				>
					{recordedLabel(row.original)}
				</Link>
			),
		},
		{
			accessorKey: "Sci_Name",
			id: "scientificName",
			header: () => (
				<SortButton
					label="Scientific name"
					sort="scientific"
					search={search}
					onSort={sortBy}
				/>
			),
			// Not a link: the common name in the row already goes to the species
			// page, and two links to the same place in one row is just noise.
			cell: ({ row }) => (
				<em className="text-[var(--bark)]">{row.original.Sci_Name}</em>
			),
		},
		{
			accessorKey: "Confidence",
			id: "confidence",
			header: () => (
				<div className="text-right">
					<SortButton
						label="Confidence"
						sort="confidence"
						search={search}
						onSort={sortBy}
					/>
				</div>
			),
			cell: ({ row }) => (
				<div className="flex justify-end">
					{row.original.Confidence === null ? (
						<span className="tabular-data text-[var(--bark)]">—</span>
					) : (
						<ConfidencePill confidence={row.original.Confidence} />
					)}
				</div>
			),
		},
		{
			id: "audio",
			// Stays in the accessibility tree when compact hides it: an unlabelled
			// column is a worse trade than the ~88px the word costs.
			header: () => (
				<span className="sr-only @min-[64rem]:not-sr-only">Recording</span>
			),
			cell: ({ row }) => (
				<div className="flex justify-end">
					<RecordingButton row={row.original} />
				</div>
			),
			enableHiding: false,
		},
	];

	const table = useReactTable({
		columns,
		data: page.rows,
		getCoreRowModel: getCoreRowModel(),
		getRowId: detectionRowKey,
		manualPagination: true,
		manualSorting: true,
		enableRowSelection: true,
		pageCount: Math.max(1, Math.ceil(page.total / search.pageSize)),
		onRowSelectionChange,
		state: { rowSelection },
	});

	const pageCount = Math.max(1, Math.ceil(page.total / search.pageSize));
	const rangeStart =
		page.total === 0 ? 0 : (search.page - 1) * search.pageSize + 1;
	const rangeEnd = Math.min(search.page * search.pageSize, page.total);
	return (
		// A column, not a stack: the scrollport takes the leftover height so the
		// rows are the only thing that scrolls, and the pager below stays put.
		// `min-h-0` is what lets it shrink -- a flex child defaults to
		// `min-height: auto` and would otherwise push the pager off the page.
		// No gap: the rows scroll directly beneath the pager's top rule, so the
		// footer reads as the edge of the scrollport rather than floating over it.
		<div className="@container flex min-h-0 flex-1 flex-col">
			<Table
				className="@min-[34rem]:min-w-[34rem] @min-[64rem]:min-w-[62rem] min-w-[26rem] table-fixed"
				containerClassName="min-h-0 flex-1 overflow-y-auto"
			>
				{/* Sticky per-`th` rather than on the `thead`: with the collapsed
				    borders Tailwind's preflight sets, the row's own border stays
				    behind with the row instead of travelling with the pinned header,
				    so the rule is drawn as an inset shadow on the cells. The base
				    `[&_tr]:border-b` is switched off or the two stack into a visible
				    double line. The card's background sits behind the fill -- both
				    stops of that gradient resolve to --paper-raised, so flat matches. */}
				<TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-[var(--surface-strong)] [&_th]:shadow-[inset_0_-1px_0_var(--line)] [&_tr]:border-none">
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id}>
							{headerGroup.headers.map((header) => (
								<TableHead
									key={header.id}
									className={`font-semibold ${HEADER_CLASSES[header.column.id] ?? ""}`}
								>
									{header.isPlaceholder
										? null
										: flexRender(
												header.column.columnDef.header,
												header.getContext(),
											)}
								</TableHead>
							))}
						</TableRow>
					))}
				</TableHeader>
				{/* No empty row here: the page renders its own empty card instead of
				    this table, so the header, footer and pager come off with it. */}
				<TableBody>
					{table.getRowModel().rows.map((row) => (
						<TableRow
							key={row.id}
							data-state={row.getIsSelected() && "selected"}
						>
							{row.getVisibleCells().map((cell) => (
								<TableCell
									key={cell.id}
									className={CELL_CLASSES[cell.column.id]}
								>
									{flexRender(cell.column.columnDef.cell, cell.getContext())}
								</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>

			{/* The two halves measure ~364px side by side, so 26rem is the real
			    point where they stop fitting -- the old 38rem stacked them while
			    there was still most of a row's worth of space going spare. */}
			<div className="flex shrink-0 @min-[26rem]:flex-row flex-col @min-[26rem]:items-center @min-[26rem]:justify-between gap-3 border-t pt-3 text-sm">
				<span className="tabular-data text-muted-foreground">
					Showing {rangeStart}–{rangeEnd} of {page.total}
				</span>
				<div className="flex items-center gap-1">
					<label className="flex items-center gap-2 text-muted-foreground">
						<span className="sr-only">Detections per page</span>
						<select
							className="h-8 rounded-md border border-input bg-card px-2 text-sm hover:bg-accent focus-visible:border-[var(--hover-line)]"
							value={search.pageSize}
							onChange={(event) =>
								updateSearch({
									page: 1,
									pageSize: Number(event.target.value) as 25 | 50 | 100,
								})
							}
						>
							<option value={25}>25 / page</option>
							<option value={50}>50 / page</option>
							<option value={100}>100 / page</option>
						</select>
					</label>
					<Button
						aria-label="Previous page"
						disabled={search.page <= 1}
						size="icon"
						variant="outline"
						onClick={() => updateSearch({ page: search.page - 1 })}
					>
						<ChevronLeft />
					</Button>
					{/* Exactly the widest string it can hold: both sides top out at
					    `pageCount`'s digit count, `tabular-data` pins every digit to
					    1ch, and " / " measures ~0.7em. Counting the separator as three
					    characters instead over-reserved by 15px, which is what left the
					    arrows looking stranded. Fixed per page count, so paging never
					    reflows it. */}
					<span
						className="tabular-data text-center text-muted-foreground"
						style={{
							minWidth: `calc(${String(pageCount).length * 2}ch + 0.75em)`,
						}}
					>
						{search.page} / {pageCount}
					</span>
					<Button
						aria-label="Next page"
						disabled={search.page >= pageCount}
						size="icon"
						variant="outline"
						onClick={() => updateSearch({ page: search.page + 1 })}
					>
						<ChevronRight />
					</Button>
				</div>
			</div>
		</div>
	);
}
