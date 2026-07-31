import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button.tsx";
import type {
	EffectiveSpeciesState,
	SpeciesControlRow,
	SpeciesPolicy,
} from "~/lib/species-control-data.ts";

export type SpeciesControlViewRow = SpeciesControlRow & {
	policy: SpeciesPolicy;
	effective: EffectiveSpeciesState;
};

function confidenceLabel(value: number | null) {
	return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function lastSeenLabel(value: string | null) {
	if (!value) return "Never";
	const date = new Date(value);
	return Number.isNaN(date.valueOf())
		? value.replace("T", " ")
		: new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export function SpeciesControlTable({
	rows,
	page,
	pageCount,
	total,
	selected,
	onSelectedChange,
	onCustomChange,
	onPolicyChange,
	onHistory,
	onPageChange,
}: {
	rows: SpeciesControlViewRow[];
	page: number;
	pageCount: number;
	total: number;
	selected: Set<string>;
	onSelectedChange: (next: Set<string>) => void;
	onCustomChange: (sciName: string, checked: boolean) => void;
	onPolicyChange: (sciName: string, policy: SpeciesPolicy) => void;
	onHistory: (row: SpeciesControlViewRow) => void;
	onPageChange: (page: number) => void;
}) {
	const allSelected =
		rows.length > 0 && rows.every((row) => selected.has(row.sciName));
	const rangeStart = total ? (page - 1) * 50 + 1 : 0;
	const rangeEnd = Math.min(page * 50, total);
	return (
		<div className="space-y-3">
			<div className="overflow-x-auto">
				<table className="w-full min-w-[74rem] border-collapse text-sm">
					<thead>
						<tr className="border-[var(--line)] border-b text-left text-muted-foreground text-xs">
							<th className="w-9 py-2 pr-2">
								<input
									aria-label="Select all species on this page"
									checked={allSelected}
									className="size-3.5 accent-[var(--moss)]"
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
							</th>
							<th className="py-2 pr-4">Species</th>
							<th className="py-2 pr-4">History</th>
							<th className="py-2 pr-4 text-center">Custom</th>
							<th className="py-2 pr-4">Policy</th>
							<th className="py-2 pr-4">Effective</th>
							<th className="py-2 text-right">Manage</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr
								key={row.sciName}
								className="border-[var(--line)] border-b last:border-b-0 hover:bg-accent/60"
							>
								<td className="py-3 pr-2 align-top">
									<input
										aria-label={`Select ${row.comName}`}
										checked={selected.has(row.sciName)}
										className="size-3.5 accent-[var(--moss)]"
										type="checkbox"
										onChange={(event) => {
											const next = new Set(selected);
											event.target.checked
												? next.add(row.sciName)
												: next.delete(row.sciName);
											onSelectedChange(next);
										}}
									/>
								</td>
								<td className="py-3 pr-4 align-top">
									<div className="font-medium">{row.comName}</div>
									<em className="mt-0.5 block text-[var(--bark)] text-xs">
										{row.sciName}
									</em>
									{row.probability !== null ? (
										<span className="tabular-data mt-1 block text-[11px] text-muted-foreground">
											Range {Math.round(row.probability * 100)}%
										</span>
									) : null}
								</td>
								<td className="py-3 pr-4 align-top">
									<div className="tabular-data">
										{row.history.detections.toLocaleString()} calls ·{" "}
										{row.history.recordings.toLocaleString()} clips
									</div>
									<div className="mt-1 text-muted-foreground text-xs">
										Last {lastSeenLabel(row.history.lastSeen)} · max{" "}
										{confidenceLabel(row.history.maxConfidence)}
									</div>
								</td>
								<td className="py-3 pr-4 text-center align-top">
									<input
										aria-label={`Include ${row.comName} in Custom list`}
										checked={row.custom}
										disabled={row.policy === "never"}
										className="size-4 accent-[var(--moss)] disabled:opacity-40"
										type="checkbox"
										onChange={(event) =>
											onCustomChange(row.sciName, event.target.checked)
										}
									/>
								</td>
								<td className="py-3 pr-4 align-top">
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
								</td>
								<td className="py-3 pr-4 align-top">
									<span
										className={`inline-flex rounded-full px-2 py-1 text-xs ${row.effective.outcome === "blocked" ? "bg-[color-mix(in_oklab,var(--clay)_13%,white)] text-[var(--clay)]" : row.effective.outcome === "detectable" ? "bg-[color-mix(in_oklab,var(--sage)_35%,white)] text-[var(--moss)]" : "bg-muted text-muted-foreground"}`}
									>
										{row.effective.reason}
									</span>
								</td>
								<td className="py-3 text-right align-top">
									{row.history.detections > 0 ? (
										<Button
											size="xs"
											variant="outline"
											onClick={() => onHistory(row)}
										>
											<Trash2 />
											Delete history
										</Button>
									) : (
										<span className="text-muted-foreground text-xs">
											No history
										</span>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{rows.length === 0 ? (
				<p className="py-8 text-center text-muted-foreground text-sm">
					No installed species match these filters.
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
