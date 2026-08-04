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

const COLUMN_WIDTHS = [
	"w-[4.2%]",
	"w-[22%]",
	"w-[24%]",
	"w-[24%]",
	"w-[14%]",
	"w-[11.8%]",
];
const COLUMN_IDS = [
	"select",
	"recorded",
	"species",
	"scientificName",
	"confidence",
	"audio",
];

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
				Recording
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
			<Input
				className="!w-36"
				id={id}
				type="date"
				value={value}
				onChange={(event) => onChange(event.target.value || undefined)}
			/>
			<button
				type="button"
				aria-label={`Clear ${label.toLowerCase()} date`}
				className="flex size-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
				disabled={!value}
				onClick={() => onChange(undefined)}
			>
				<X className="size-4" />
			</button>
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
		<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
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
			{/* Wraps because the two filters together are wider than a phone: side by
			    side they need ~396px, and `shrink-0` means they would push the page
			    out rather than squeeze. Above `sm` there is room for both on the
			    line and the wrap never triggers. */}
			<div className="flex shrink-0 flex-wrap items-center gap-2">
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
				<div className="flex justify-center">
					<input
						aria-label="Select all detections on this page"
						checked={table.getIsAllPageRowsSelected()}
						className="size-3.5 accent-[var(--moss)]"
						type="checkbox"
						onChange={table.getToggleAllPageRowsSelectedHandler()}
					/>
				</div>
			),
			cell: ({ row }) => (
				<div className="flex justify-center">
					<input
						aria-label={`Select ${row.original.Com_Name}`}
						checked={row.getIsSelected()}
						className="size-3.5 accent-[var(--moss)]"
						type="checkbox"
						onChange={row.getToggleSelectedHandler()}
					/>
				</div>
			),
			enableHiding: false,
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
			header: "Recording",
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
		<div className="space-y-3">
			<Table className="min-w-[62rem] table-fixed">
				<colgroup>
					{COLUMN_WIDTHS.map((width, index) => (
						<col key={COLUMN_IDS[index]} className={width} />
					))}
				</colgroup>
				<TableHeader>
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id}>
							{headerGroup.headers.map((header) => (
								<TableHead
									key={header.id}
									className={
										header.column.id === "audio"
											? "pr-0 text-right font-semibold"
											: "font-semibold"
									}
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
									className={cell.column.id === "audio" ? "pr-0" : undefined}
								>
									{flexRender(cell.column.columnDef.cell, cell.getContext())}
								</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>

			<div className="flex flex-col gap-3 border-t pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
				<span className="tabular-data text-muted-foreground">
					Showing {rangeStart}–{rangeEnd} of {page.total}
				</span>
				<div className="flex items-center gap-2">
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
						size="icon-xs"
						variant="outline"
						onClick={() => updateSearch({ page: search.page - 1 })}
					>
						<ChevronLeft />
					</Button>
					<span className="tabular-data min-w-18 text-center text-muted-foreground">
						{search.page} / {pageCount}
					</span>
					<Button
						aria-label="Next page"
						disabled={search.page >= pageCount}
						size="icon-xs"
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
