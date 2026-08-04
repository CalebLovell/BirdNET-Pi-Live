import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
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
	SpeciesPolicy,
} from "~/lib/species-control-data.ts";

export type SpeciesControlViewRow = SpeciesControlRow & {
	policy: SpeciesPolicy;
};

export type SpeciesSortKey = "species" | "count" | "policy";

/**
 * Each column starts in the direction that is useful rather than in a uniform
 * one: names read A-Z, but a count is being asked "which is highest?". Reverse
 * flips whichever of those the column began with.
 */
const NATURAL_ASCENDING: Record<SpeciesSortKey, boolean> = {
	species: true,
	count: false,
	policy: true,
};

function SortHeader({
	label,
	sortKey,
	sort,
	reverse,
	onSortChange,
	align = "left",
	className = "",
}: {
	label: string;
	sortKey: SpeciesSortKey;
	sort: SpeciesSortKey;
	reverse: boolean;
	onSortChange: (key: SpeciesSortKey) => void;
	align?: "left" | "right";
	className?: string;
}) {
	const active = sort === sortKey;
	const ascending = NATURAL_ASCENDING[sortKey] !== reverse;
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
	reverse,
	onSortChange,
	onSelectedChange,
	onCustomChange,
	onPolicyChange,
	onPageChange,
	showCustom,
}: {
	rows: SpeciesControlViewRow[];
	page: number;
	pageCount: number;
	total: number;
	selected: Set<string>;
	sort: SpeciesSortKey;
	reverse: boolean;
	onSortChange: (key: SpeciesSortKey) => void;
	onSelectedChange: (next: Set<string>) => void;
	onCustomChange: (sciName: string, checked: boolean) => void;
	onPolicyChange: (sciName: string, policy: SpeciesPolicy) => void;
	onPageChange: (page: number) => void;
	/** Custom membership only bites in Custom scope, so Normal scope hides it. */
	showCustom: boolean;
}) {
	const allSelected =
		rows.length > 0 && rows.every((row) => selected.has(row.sciName));
	const rangeStart = total ? (page - 1) * 50 + 1 : 0;
	const rangeEnd = Math.min(page * 50, total);
	return (
		<div className="space-y-3">
			<Table className="min-w-[44rem] table-fixed">
				<colgroup>
					<col className="w-[6%]" />
					<col className={showCustom ? "w-[25%]" : "w-[30%]"} />
					<col className={showCustom ? "w-[27%]" : "w-[32%]"} />
					<col className="w-[12%]" />
					{showCustom ? <col className="w-[12%]" /> : null}
					<col className={showCustom ? "w-[18%]" : "w-[20%]"} />
				</colgroup>
				<TableHeader>
					<TableRow>
						<TableHead className="text-center font-semibold">
							<input
								aria-label="Select all species on this page"
								checked={allSelected}
								className="mx-auto block size-3.5 accent-[var(--moss)]"
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
							reverse={reverse}
							onSortChange={onSortChange}
						/>
						<TableHead className="font-semibold">Scientific name</TableHead>
						<SortHeader
							label="Count"
							sortKey="count"
							sort={sort}
							reverse={reverse}
							onSortChange={onSortChange}
							align="right"
						/>
						{showCustom ? (
							<TableHead className="text-center font-semibold">
								Custom
							</TableHead>
						) : null}
						<SortHeader
							label="Policy"
							sortKey="policy"
							sort={sort}
							reverse={reverse}
							onSortChange={onSortChange}
							align="right"
						/>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((row) => (
						<TableRow key={row.sciName}>
							<TableCell className="text-center">
								<input
									aria-label={`Select ${row.comName}`}
									checked={selected.has(row.sciName)}
									className="mx-auto block size-3.5 accent-[var(--moss)]"
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
							<TableCell>
								<div className="font-medium">{row.comName}</div>
							</TableCell>
							<TableCell>
								<em className="text-[var(--bark)]">{row.sciName}</em>
							</TableCell>
							{/* Most of a 6,000-row catalogue has never been heard, so a
							    zero is muted rather than competing with real counts. */}
							<TableCell
								className={`tabular-data text-right ${row.history.detections ? "" : "text-muted-foreground"}`}
							>
								{row.history.detections.toLocaleString()}
							</TableCell>
							{showCustom ? (
								<TableCell className="text-center">
									<input
										aria-label={`Include ${row.comName} in Custom list`}
										checked={row.custom}
										disabled={row.policy === "never"}
										className="mx-auto block size-4 accent-[var(--moss)] disabled:opacity-40"
										type="checkbox"
										onChange={(event) =>
											onCustomChange(row.sciName, event.target.checked)
										}
									/>
								</TableCell>
							) : null}
							<TableCell className="text-right">
								<select
									aria-label={`${row.comName} policy`}
									className="h-8 rounded-md border border-input bg-card px-2 text-sm"
									value={row.policy}
									onChange={(event) =>
										onPolicyChange(
											row.sciName,
											event.target.value as SpeciesPolicy,
										)
									}
								>
									<option value="automatic">Automatic</option>
									<option value="always">Always detect</option>
									<option value="never">Never detect</option>
								</select>
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
