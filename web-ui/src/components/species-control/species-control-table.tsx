import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "~/components/ui/badge.tsx";
import { Button } from "~/components/ui/button.tsx";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table.tsx";
import type {
	SpeciesControlRow,
	SpeciesStatus,
} from "~/lib/species-control-data.ts";
import type {
	SpeciesControlSort,
	SpeciesControlSortDirection,
} from "~/lib/species-control-workspace.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";

export type SpeciesControlViewRow = SpeciesControlRow & {
	status: SpeciesStatus;
};

export type SpeciesSortKey = SpeciesControlSort;

const STATUS_RANK: Record<SpeciesStatus, number> = {
	automatic: 0,
	custom: 1,
	always: 2,
	never: 3,
};

export function sortSpeciesControlRows(
	rows: SpeciesControlViewRow[],
	sort: SpeciesSortKey,
	direction: SpeciesControlSortDirection,
): SpeciesControlViewRow[] {
	const multiplier = direction === "asc" ? 1 : -1;
	return [...rows].sort((left, right) => {
		if (sort === "count") {
			return (
				multiplier *
				(left.history.detections - right.history.detections ||
					left.comName.localeCompare(right.comName))
			);
		}
		if (sort === "status") {
			return (
				multiplier *
				(STATUS_RANK[left.status] - STATUS_RANK[right.status] ||
					left.comName.localeCompare(right.comName))
			);
		}
		const comparison =
			sort === "scientific"
				? left.sciName.localeCompare(right.sciName)
				: left.comName.localeCompare(right.comName);
		return multiplier * comparison;
	});
}

const STATUS_PRESENTATION: Record<
	SpeciesStatus,
	{ label: string; className: string }
> = {
	automatic: {
		label: "Automatic",
		className: "bg-muted text-muted-foreground",
	},
	custom: {
		label: "Custom",
		className:
			"bg-[color-mix(in_oklab,var(--sage)_35%,var(--paper-raised))] text-[var(--moss)]",
	},
	always: {
		label: "Always detect",
		className:
			"bg-[color-mix(in_oklab,var(--sand)_30%,var(--paper-raised))] text-[var(--bark)]",
	},
	never: {
		label: "Never detect",
		className:
			"bg-[color-mix(in_oklab,var(--clay)_15%,var(--paper-raised))] text-destructive",
	},
};

function SortHeader({
	label,
	sortKey,
	sort,
	direction,
	onSortChange,
	align = "left",
	className = "",
}: {
	label: string;
	sortKey: SpeciesSortKey;
	sort: SpeciesSortKey;
	direction: SpeciesControlSortDirection;
	onSortChange: (key: SpeciesSortKey) => void;
	align?: "left" | "right";
	className?: string;
}) {
	const active = sort === sortKey;
	const ascending = direction === "asc";
	const Icon = active && ascending ? ArrowUp : ArrowDown;
	return (
		<TableHead
			aria-sort={active ? (ascending ? "ascending" : "descending") : "none"}
			className={`${align === "right" ? "text-right" : ""} font-semibold ${className}`}
		>
			<button
				type="button"
				className="inline-flex items-center gap-1 hover:text-foreground"
				onClick={() => onSortChange(sortKey)}
			>
				{label}
				<Icon
					className={active ? "size-3.5" : "size-3.5 opacity-35"}
					aria-hidden="true"
				/>
			</button>
		</TableHead>
	);
}

export function SpeciesControlTable({
	rows,
	page,
	pageCount,
	total,
	selected,
	sort,
	direction,
	onSortChange,
	onSelectedChange,
	onPageChange,
}: {
	rows: SpeciesControlViewRow[];
	page: number;
	pageCount: number;
	total: number;
	selected: Set<string>;
	sort: SpeciesSortKey;
	direction: SpeciesControlSortDirection;
	onSortChange: (key: SpeciesSortKey) => void;
	onSelectedChange: (next: Set<string>) => void;
	onPageChange: (page: number) => void;
}) {
	const allSelected =
		rows.length > 0 && rows.every((row) => selected.has(row.sciName));
	const rangeStart = total ? (page - 1) * 50 + 1 : 0;
	const rangeEnd = Math.min(page * 50, total);
	return (
		<div className="space-y-3">
			<Table className="min-w-[44rem] table-fixed">
				<colgroup>
					<col className="w-[4.2%]" />
					<col className="w-[27.8%]" />
					<col className="w-[36%]" />
					<col className="w-[12%]" />
					<col className="w-[20%]" />
				</colgroup>
				<TableHeader>
					<TableRow>
						<TableHead className="text-left font-semibold">
							<input
								aria-label="Select all species on this page"
								checked={allSelected}
								className="block size-3.5 accent-[var(--moss)]"
								type="checkbox"
								onChange={(event) => {
									const next = new Set(selected);
									for (const row of rows)
										event.target.checked
											? next.add(row.sciName)
											: next.delete(row.sciName);
									onSelectedChange(next);
								}}
							/>
						</TableHead>
						<SortHeader
							label="Species"
							sortKey="species"
							sort={sort}
							direction={direction}
							onSortChange={onSortChange}
							className="pl-0"
						/>
						<SortHeader
							label="Scientific name"
							sortKey="scientific"
							sort={sort}
							direction={direction}
							onSortChange={onSortChange}
							className="pl-1"
						/>
						<SortHeader
							label="Count"
							sortKey="count"
							sort={sort}
							direction={direction}
							onSortChange={onSortChange}
							align="right"
						/>
						<SortHeader
							label="Status"
							sortKey="status"
							sort={sort}
							direction={direction}
							onSortChange={onSortChange}
							align="right"
						/>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((row) => (
						<TableRow key={row.sciName}>
							<TableCell className="text-left">
								<input
									aria-label={`Select ${row.comName}`}
									checked={selected.has(row.sciName)}
									className="block size-3.5 accent-[var(--moss)]"
									type="checkbox"
									onChange={(event) => {
										const next = new Set(selected);
										event.target.checked
											? next.add(row.sciName)
											: next.delete(row.sciName);
										onSelectedChange(next);
									}}
								/>
							</TableCell>
							<TableCell className="pl-0">
								<Link
									to="/species/$comName"
									params={{ comName: comNameToSlug(row.comName) }}
									className="font-medium no-underline hover:underline"
								>
									{row.comName}
								</Link>
							</TableCell>
							<TableCell className="pl-1">
								<em className="text-[var(--bark)]">{row.sciName}</em>
							</TableCell>
							{/* Most of a 6,000-row catalogue has never been heard, so a
							    zero is muted rather than competing with real counts. */}
							<TableCell
								className={`tabular-data text-right ${row.history.detections ? "" : "text-muted-foreground"}`}
							>
								{row.history.detections.toLocaleString()}
							</TableCell>
							<TableCell className="text-right">
								<Badge
									variant="ghost"
									className={STATUS_PRESENTATION[row.status].className}
								>
									{STATUS_PRESENTATION[row.status].label}
								</Badge>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			{rows.length === 0 ? (
				<p className="py-8 text-center text-muted-foreground text-sm">
					No installed species match that search.
				</p>
			) : null}
			<div className="flex flex-col gap-2 border-t pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
				<span className="tabular-data text-muted-foreground">
					Showing {rangeStart}–{rangeEnd} of {total}
				</span>
				<div className="flex items-center gap-2">
					<Button
						aria-label="Previous page"
						disabled={page <= 1}
						size="icon-xs"
						variant="outline"
						onClick={() => onPageChange(page - 1)}
					>
						<ChevronLeft />
					</Button>
					<span className="tabular-data min-w-16 text-center text-muted-foreground">
						{page} / {pageCount}
					</span>
					<Button
						aria-label="Next page"
						disabled={page >= pageCount}
						size="icon-xs"
						variant="outline"
						onClick={() => onPageChange(page + 1)}
					>
						<ChevronRight />
					</Button>
				</div>
			</div>
		</div>
	);
}
