import { Link } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	type OnChangeFn,
	type RowSelectionState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import {
	ArrowDown,
	ArrowUp,
	ChevronLeft,
	ChevronRight,
	Loader2,
	Pause,
	SlidersHorizontal,
	Volume2,
} from "lucide-react";
import { Button, buttonVariants } from "~/components/ui/button.tsx";
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
import { sciNameToSlug } from "~/lib/species-slug.ts";
import { usePlayableAudio } from "~/lib/use-playable-audio.ts";

type DetectionsTableProps = {
	page: DetectionPage;
	search: DetectionWorkspaceSearch;
	onSearchChange: (search: DetectionWorkspaceSearch) => void;
	columnVisibility: VisibilityState;
	onColumnVisibilityChange: OnChangeFn<VisibilityState>;
	rowSelection: RowSelectionState;
	onRowSelectionChange: OnChangeFn<RowSelectionState>;
};

type DetectionsFiltersProps = Pick<
	DetectionsTableProps,
	"search" | "onSearchChange"
>;

const COLUMN_LABELS: Record<string, string> = {
	recorded: "Recorded",
	species: "Species",
	scientificName: "Scientific name",
	confidence: "Confidence",
	latitude: "Latitude",
	longitude: "Longitude",
	cutoff: "Cutoff",
	sensitivity: "Sensitivity",
	overlap: "Overlap",
	week: "Week",
};

const TOGGLEABLE_COLUMN_IDS = Object.keys(COLUMN_LABELS);
const DEFAULT_COLUMN_WIDTHS = [
	"w-[4.2%]",
	"w-[22%]",
	"w-[24%]",
	"w-[24%]",
	"w-[14%]",
	"w-[11.8%]",
];
const DEFAULT_COLUMN_IDS = [
	"select",
	"recorded",
	"species",
	"scientificName",
	"confidence",
	"audio",
];

export const INITIAL_DETECTION_COLUMN_VISIBILITY: VisibilityState = {
	latitude: false,
	longitude: false,
	cutoff: false,
	sensitivity: false,
	overlap: false,
	week: false,
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
				onClick={togglePlay}
			>
				{isLoading ? (
					<Loader2 className="animate-spin" />
				) : isPlaying ? (
					<Pause />
				) : (
					<Volume2 />
				)}
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

export function DetectionsFilters({
	search,
	onSearchChange,
}: DetectionsFiltersProps) {
	function updateSearch(change: Partial<DetectionWorkspaceSearch>) {
		onSearchChange({ ...search, ...change });
	}

	return (
		<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<SearchInput
				aria-label="Filter by species"
				placeholder="Search detections..."
				value={search.species ?? ""}
				onChange={(event) =>
					updateSearch({
						page: 1,
						species: event.target.value || undefined,
					})
				}
				onClear={() => updateSearch({ page: 1, species: undefined })}
			/>
		</div>
	);
}

export function DetectionsTable({
	page,
	search,
	onSearchChange,
	columnVisibility,
	onColumnVisibilityChange,
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
				<span className="tabular-data text-sm">
					{recordedLabel(row.original)}
				</span>
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
			cell: ({ row }) => (
				<Link
					to="/species/$sciName"
					params={{ sciName: sciNameToSlug(row.original.Sci_Name) }}
					className="font-medium no-underline"
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
				<div className="tabular-data text-right text-[var(--bark)]">
					{row.original.Confidence === null
						? "—"
						: `${Math.round(row.original.Confidence * 100)}%`}
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
		{
			accessorKey: "Lat",
			id: "latitude",
			header: "Latitude",
			cell: ({ row }) => (
				<span className="tabular-data">{row.original.Lat ?? "—"}</span>
			),
		},
		{
			accessorKey: "Lon",
			id: "longitude",
			header: "Longitude",
			cell: ({ row }) => (
				<span className="tabular-data">{row.original.Lon ?? "—"}</span>
			),
		},
		{
			accessorKey: "Cutoff",
			id: "cutoff",
			header: "Cutoff",
			cell: ({ row }) => (
				<span className="tabular-data">{row.original.Cutoff ?? "—"}</span>
			),
		},
		{
			accessorKey: "Sens",
			id: "sensitivity",
			header: "Sensitivity",
			cell: ({ row }) => (
				<span className="tabular-data">{row.original.Sens ?? "—"}</span>
			),
		},
		{
			accessorKey: "Overlap",
			id: "overlap",
			header: "Overlap",
			cell: ({ row }) => (
				<span className="tabular-data">{row.original.Overlap ?? "—"}</span>
			),
		},
		{
			accessorKey: "Week",
			id: "week",
			header: "Week",
			cell: ({ row }) => (
				<span className="tabular-data">{row.original.Week ?? "—"}</span>
			),
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
		onColumnVisibilityChange,
		onRowSelectionChange,
		state: { columnVisibility, rowSelection },
	});

	const pageCount = Math.max(1, Math.ceil(page.total / search.pageSize));
	const rangeStart =
		page.total === 0 ? 0 : (search.page - 1) * search.pageSize + 1;
	const rangeEnd = Math.min(search.page * search.pageSize, page.total);
	const usesDefaultColumnLayout = table
		.getVisibleLeafColumns()
		.every((column, index) => column.id === DEFAULT_COLUMN_IDS[index]);
	return (
		<div className="space-y-3">
			<div className="flex min-h-9 justify-end">
				<div className="flex items-center gap-2">
					<Input
						aria-label="Detected on or after"
						className="!w-40"
						type="date"
						value={search.from ?? ""}
						onChange={(event) =>
							updateSearch({ page: 1, from: event.target.value || undefined })
						}
					/>
					<Input
						aria-label="Detected on or before"
						className="!w-40"
						type="date"
						value={search.to ?? ""}
						onChange={(event) =>
							updateSearch({ page: 1, to: event.target.value || undefined })
						}
					/>
					<details className="relative">
						<summary
							className={buttonVariants({
								variant: "outline",
								size: "sm",
							})}
						>
							<SlidersHorizontal />
							Columns
						</summary>
						<div className="feature-card absolute right-0 z-10 mt-2 grid min-w-48 gap-2 rounded-md p-3 text-sm shadow-lg">
							{TOGGLEABLE_COLUMN_IDS.map((columnId) => {
								const isVisible = columnVisibility[columnId] ?? true;
								return (
									<label key={columnId} className="flex items-center gap-2">
										<input
											checked={isVisible}
											className="size-3.5 accent-[var(--moss)]"
											type="checkbox"
											onChange={() =>
												onColumnVisibilityChange({
													...columnVisibility,
													[columnId]: !isVisible,
												})
											}
										/>
										{COLUMN_LABELS[columnId]}
									</label>
								);
							})}
						</div>
					</details>
				</div>
			</div>

			<Table
				className={
					usesDefaultColumnLayout ? "min-w-[62rem] table-fixed" : undefined
				}
			>
				{usesDefaultColumnLayout ? (
					<colgroup>
						{DEFAULT_COLUMN_WIDTHS.map((width, index) => (
							<col key={DEFAULT_COLUMN_IDS[index]} className={width} />
						))}
					</colgroup>
				) : null}
				<TableHeader>
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id}>
							{headerGroup.headers.map((header) => (
								<TableHead
									key={header.id}
									className={
										header.column.id === "audio" ? "pr-0 text-right" : undefined
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
				<TableBody>
					{page.rows.length === 0 ? (
						<TableRow>
							<TableCell
								className="py-12 text-center text-muted-foreground"
								colSpan={table.getVisibleLeafColumns().length}
							>
								{page.total === 0
									? "No detections have been recorded yet."
									: "No detections match these filters."}
							</TableCell>
						</TableRow>
					) : (
						table.getRowModel().rows.map((row) => (
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
						))
					)}
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
							className="h-8 rounded-md border border-input bg-card px-2 text-sm outline-none hover:bg-accent focus-visible:border-[var(--hover-line)]"
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
