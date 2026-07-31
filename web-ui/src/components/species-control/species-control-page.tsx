import Fuse from "fuse.js";
import {
	CircleAlert,
	Crosshair,
	ListFilter,
	Loader2,
	MapPinned,
	Save,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeaderCard } from "~/components/page-header-card.tsx";
import { Button } from "~/components/ui/button.tsx";
import { Input } from "~/components/ui/input.tsx";
import {
	applySpeciesPolicy,
	effectiveSpeciesState,
	type HistoryDeletePreview,
	type HistoryDeleteResult,
	type SpeciesControlPageData,
	type SpeciesControlSaveInput,
	type SpeciesPolicy,
	type SpeciesRangePreview,
} from "~/lib/species-control-data.ts";
import {
	HistoryDeleteDetails,
	SpeciesControlDialog,
} from "./species-control-dialogs.tsx";
import { SpeciesControlSummary } from "./species-control-summary.tsx";
import {
	SpeciesControlTable,
	type SpeciesControlViewRow,
} from "./species-control-table.tsx";
import { SpeciesControlTools } from "./species-control-tools.tsx";

type PageAdapters = {
	onSave?: (input: SpeciesControlSaveInput) => Promise<{ revision: string }>;
	onPreview?: () => Promise<SpeciesRangePreview>;
	onHistoryPreview?: (sciName: string) => Promise<HistoryDeletePreview>;
	onHistoryDelete?: (input: {
		sciName: string;
		expectedRows: number;
	}) => Promise<HistoryDeleteResult>;
	onCommitted?: () => void | Promise<void>;
};

type Filter =
	| "all"
	| "detected"
	| "unseen"
	| "custom"
	| "excluded"
	| "whitelisted"
	| "eligible"
	| "ineligible";

function setFrom(
	data: SpeciesControlPageData,
	key: "custom" | "excluded" | "whitelisted",
) {
	return new Set(data.rows.filter((row) => row[key]).map((row) => row.sciName));
}

function changedCount(current: Set<string>, baseline: Set<string>) {
	let count = 0;
	for (const value of current) if (!baseline.has(value)) count++;
	for (const value of baseline) if (!current.has(value)) count++;
	return count;
}

export function SpeciesControlPage({
	initialData,
	onSave,
	onPreview,
	onHistoryPreview,
	onHistoryDelete,
	onCommitted,
}: { initialData: SpeciesControlPageData } & PageAdapters) {
	const initialSets = useMemo(
		() => ({
			custom: setFrom(initialData, "custom"),
			excluded: setFrom(initialData, "excluded"),
			whitelisted: setFrom(initialData, "whitelisted"),
		}),
		[initialData],
	);
	const [custom, setCustom] = useState(() => new Set(initialSets.custom));
	const [excluded, setExcluded] = useState(() => new Set(initialSets.excluded));
	const [whitelisted, setWhitelisted] = useState(
		() => new Set(initialSets.whitelisted),
	);
	const [baseline, setBaseline] = useState(() => initialSets);
	const [revision, setRevision] = useState(initialData.revision);
	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<Filter>("all");
	const [page, setPage] = useState(1);
	const [selected, setSelected] = useState(new Set<string>());
	const [preview, setPreview] = useState<SpeciesRangePreview | null>(null);
	const [previewing, setPreviewing] = useState(false);
	const [removeUnresolved, setRemoveUnresolved] = useState(new Set<string>());
	const [dialog, setDialog] = useState<"save" | "reset" | null>(null);
	const [historyPreview, setHistoryPreview] =
		useState<HistoryDeletePreview | null>(null);
	const [pending, setPending] = useState(false);
	const [feedback, setFeedback] = useState<{
		tone: "error" | "success";
		message: string;
	} | null>(null);

	const customMode = custom.size > 0;
	const pendingCount =
		changedCount(custom, baseline.custom) +
		changedCount(excluded, baseline.excluded) +
		changedCount(whitelisted, baseline.whitelisted) +
		removeUnresolved.size;
	const probabilities = useMemo(
		() =>
			new Map(
				(preview?.species ?? []).map((row) => [row.sciName, row.probability]),
			),
		[preview],
	);
	const viewRows = useMemo<SpeciesControlViewRow[]>(
		() =>
			initialData.rows.map((row) => {
				const probability = probabilities.get(row.sciName);
				const geographicallyEligible =
					preview?.status === "available"
						? probability !== undefined
						: row.geographicallyEligible;
				const policy: SpeciesPolicy = excluded.has(row.sciName)
					? "never"
					: whitelisted.has(row.sciName)
						? "always"
						: "automatic";
				const state = {
					...row,
					custom: custom.has(row.sciName),
					excluded: excluded.has(row.sciName),
					whitelisted: whitelisted.has(row.sciName),
					geographicallyEligible,
					probability: probability ?? null,
				};
				return {
					...state,
					policy,
					effective: effectiveSpeciesState({
						customMode,
						custom: state.custom,
						excluded: state.excluded,
						whitelisted: state.whitelisted,
						geographicallyEligible,
					}),
				};
			}),
		[
			custom,
			customMode,
			excluded,
			initialData.rows,
			preview,
			probabilities,
			whitelisted,
		],
	);
	const searched = useMemo(() => {
		if (!query.trim()) return viewRows;
		return new Fuse(viewRows, { keys: ["comName", "sciName"], threshold: 0.3 })
			.search(query.trim())
			.map((result) => result.item);
	}, [query, viewRows]);
	const filtered = searched.filter((row) => {
		switch (filter) {
			case "detected":
				return row.history.detections > 0;
			case "unseen":
				return row.history.detections === 0;
			case "custom":
				return row.custom;
			case "excluded":
				return row.excluded;
			case "whitelisted":
				return row.whitelisted;
			case "eligible":
				return row.geographicallyEligible === true;
			case "ineligible":
				return row.geographicallyEligible === false;
			default:
				return true;
		}
	});
	const pageCount = Math.max(1, Math.ceil(filtered.length / 50));
	const safePage = Math.min(page, pageCount);
	const pagedRows = filtered.slice((safePage - 1) * 50, safePage * 50);
	const unresolvedCount =
		Object.values(initialData.unresolved).reduce(
			(sum, values) => sum + values.length,
			0,
		) - removeUnresolved.size;

	function updatePolicy(sciName: string, policy: SpeciesPolicy) {
		const next = applySpeciesPolicy(
			{
				custom: custom.has(sciName),
				policy: excluded.has(sciName)
					? "never"
					: whitelisted.has(sciName)
						? "always"
						: "automatic",
			},
			policy,
			customMode,
		);
		setCustom((current) => {
			const value = new Set(current);
			next.custom ? value.add(sciName) : value.delete(sciName);
			return value;
		});
		setExcluded((current) => {
			const value = new Set(current);
			policy === "never" ? value.add(sciName) : value.delete(sciName);
			return value;
		});
		setWhitelisted((current) => {
			const value = new Set(current);
			policy === "always" ? value.add(sciName) : value.delete(sciName);
			return value;
		});
	}

	function toggleCustom(sciName: string, checked: boolean) {
		setCustom((current) => {
			const value = new Set(current);
			if (checked) {
				// Turning on restricted scope must not make existing Always-detect
				// species ineffective. Include them in the same staged transition.
				if (value.size === 0) for (const name of whitelisted) value.add(name);
				value.add(sciName);
			} else value.delete(sciName);
			return value;
		});
	}

	function applyBulk(policy: SpeciesPolicy | "custom") {
		for (const sciName of selected) {
			if (policy === "custom") toggleCustom(sciName, true);
			else updatePolicy(sciName, policy);
		}
	}

	function discard() {
		setCustom(new Set(baseline.custom));
		setExcluded(new Set(baseline.excluded));
		setWhitelisted(new Set(baseline.whitelisted));
		setRemoveUnresolved(new Set());
		setDialog(null);
		setFeedback(null);
	}

	async function save() {
		if (!onSave) return;
		setPending(true);
		setFeedback(null);
		try {
			const input: SpeciesControlSaveInput = {
				revision,
				custom: [...custom],
				excluded: [...excluded],
				whitelisted: [...whitelisted],
				removeUnresolved: [...removeUnresolved].map((key) => {
					const [list, raw] = key.split("\0");
					return { list: list as "custom" | "excluded" | "whitelisted", raw };
				}),
			};
			const result = await onSave(input);
			setRevision(result.revision);
			setBaseline({
				custom: new Set(custom),
				excluded: new Set(excluded),
				whitelisted: new Set(whitelisted),
			});
			setRemoveUnresolved(new Set());
			setDialog(null);
			setFeedback({
				tone: "success",
				message: "Species controls saved. New recordings use them immediately.",
			});
			await onCommitted?.();
		} catch (error) {
			setFeedback({
				tone: "error",
				message:
					error instanceof Error
						? error.message
						: "Species controls could not be saved.",
			});
			setDialog(null);
		} finally {
			setPending(false);
		}
	}

	async function runPreview() {
		if (!onPreview) return;
		setPreviewing(true);
		setFeedback(null);
		try {
			const result = await onPreview();
			setPreview(result);
			if (result.status === "unavailable")
				setFeedback({
					tone: "error",
					message: result.message ?? "Range preview is unavailable.",
				});
		} finally {
			setPreviewing(false);
		}
	}

	async function openHistory(row: SpeciesControlViewRow) {
		if (!onHistoryPreview) return;
		setPending(true);
		try {
			setHistoryPreview(await onHistoryPreview(row.sciName));
		} catch (error) {
			setFeedback({
				tone: "error",
				message:
					error instanceof Error
						? error.message
						: "History preview could not be loaded.",
			});
		} finally {
			setPending(false);
		}
	}

	async function deleteHistory() {
		if (!historyPreview || !onHistoryDelete) return;
		setPending(true);
		try {
			const result = await onHistoryDelete({
				sciName: historyPreview.sciName,
				expectedRows: historyPreview.rows,
			});
			setFeedback({
				tone: result.failedAssets ? "error" : "success",
				message: `Deleted ${result.deletedRows} detections and ${result.deletedAssets} recording files.`,
			});
			setHistoryPreview(null);
			await onCommitted?.();
		} catch (error) {
			setFeedback({
				tone: "error",
				message:
					error instanceof Error
						? error.message
						: "History could not be deleted.",
			});
		} finally {
			setPending(false);
		}
	}

	function importLists(text: string) {
		try {
			const known = new Set(initialData.rows.map((row) => row.sciName));
			const normalizeImported = (value: unknown) => {
				if (typeof value !== "string") return null;
				const trimmed = value.trim();
				if (known.has(trimmed)) return trimmed;
				const separator = trimmed.indexOf("_");
				const scientific = separator > 0 ? trimmed.slice(0, separator) : "";
				return known.has(scientific) ? scientific : null;
			};
			const parsed = text.trimStart().startsWith("{")
				? (JSON.parse(text) as Record<string, unknown>)
				: { custom: text.split(/\r?\n/) };
			const imported = {
				custom: Array.isArray(parsed.custom)
					? new Set(
							parsed.custom
								.map(normalizeImported)
								.filter((value): value is string => value !== null),
						)
					: new Set(custom),
				excluded: Array.isArray(parsed.excluded)
					? new Set(
							parsed.excluded
								.map(normalizeImported)
								.filter((value): value is string => value !== null),
						)
					: new Set(excluded),
				whitelisted: Array.isArray(parsed.whitelisted)
					? new Set(
							parsed.whitelisted
								.map(normalizeImported)
								.filter((value): value is string => value !== null),
						)
					: new Set(whitelisted),
			};
			if (imported.custom.size > 0)
				for (const name of imported.whitelisted) imported.custom.add(name);
			for (const name of imported.excluded) {
				imported.custom.delete(name);
				imported.whitelisted.delete(name);
			}
			setCustom(imported.custom);
			setExcluded(imported.excluded);
			setWhitelisted(imported.whitelisted);
			setFeedback({
				tone: "success",
				message: "Imported lists are staged. Review them before saving.",
			});
		} catch {
			setFeedback({
				tone: "error",
				message: "That file is not a valid species-list export.",
			});
		}
	}

	function exportLists() {
		const blob = new Blob(
			[
				JSON.stringify(
					{
						custom: [...custom],
						excluded: [...excluded],
						whitelisted: [...whitelisted],
					},
					null,
					2,
				),
			],
			{ type: "application/json" },
		);
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = "birdnet-species-lists.json";
		anchor.click();
		URL.revokeObjectURL(url);
	}

	return (
		<div className="page-wrap space-y-4 py-4">
			<PageHeaderCard
				title="Species control"
				description="Decide which installed species BirdNET may detect, then review the real effect before saving."
				action={
					<Button
						disabled={!onPreview || previewing}
						size="sm"
						variant="outline"
						onClick={runPreview}
					>
						{previewing ? <Loader2 className="animate-spin" /> : <MapPinned />}
						Check current range
					</Button>
				}
			>
				<div className="mt-4 flex flex-col gap-3 border-[var(--line)] border-t pt-4 md:flex-row md:items-center md:justify-between">
					<div className="flex items-start gap-3">
						<span
							className={`mt-0.5 flex size-8 items-center justify-center rounded-full ${customMode ? "bg-[color-mix(in_oklab,var(--sand)_30%,white)] text-[var(--bark)]" : "bg-[color-mix(in_oklab,var(--sage)_30%,white)] text-[var(--moss)]"}`}
						>
							<Crosshair className="size-4" />
						</span>
						<div>
							<p className="font-semibold text-sm">
								{customMode
									? "Custom-only detection scope"
									: "Normal detection scope"}
							</p>
							<p className="mt-0.5 text-muted-foreground text-xs">
								{customMode
									? `Only ${custom.size.toLocaleString()} Custom species can pass the classifier. Exclusions still win.`
									: "All geographically eligible installed species can pass unless excluded."}
							</p>
						</div>
					</div>
					{preview?.status === "available" ? (
						<p className="tabular-data text-muted-foreground text-xs">
							Range week {preview.week} · threshold {preview.threshold}
						</p>
					) : null}
				</div>
			</PageHeaderCard>

			<SpeciesControlSummary
				custom={custom.size}
				excluded={excluded.size}
				whitelisted={whitelisted.size}
				eligible={
					viewRows.filter(
						(row) =>
							row.geographicallyEligible === true &&
							!row.excluded &&
							(!customMode || row.custom),
					).length
				}
				unresolved={unresolvedCount}
				pending={pendingCount}
			/>

			{feedback ? (
				<p
					className={`flex items-center gap-2 text-sm ${feedback.tone === "error" ? "text-destructive" : "text-muted-foreground"}`}
				>
					{feedback.tone === "error" ? (
						<CircleAlert className="size-4" />
					) : null}
					{feedback.message}
				</p>
			) : null}

			<section
				aria-label="Species policies"
				className="feature-card rounded-md p-4"
			>
				<div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
					<div className="flex flex-1 flex-col gap-2 sm:flex-row">
						<label className="flex-1" htmlFor="species-control-search">
							<span className="mb-1 block text-muted-foreground text-xs">
								Search installed species
							</span>
							<Input
								id="species-control-search"
								value={query}
								placeholder="Coyote, squirrel, Canis…"
								onChange={(event) => {
									setQuery(event.target.value);
									setPage(1);
								}}
							/>
						</label>
						<label>
							<span className="mb-1 block text-muted-foreground text-xs">
								Show
							</span>
							<select
								className="h-9 min-w-44 rounded-md border border-input bg-card px-3 text-sm"
								value={filter}
								onChange={(event) => {
									setFilter(event.target.value as Filter);
									setPage(1);
								}}
							>
								<option value="all">All installed</option>
								<option value="detected">Detected here</option>
								<option value="unseen">Not yet detected</option>
								<option value="custom">Custom list</option>
								<option value="excluded">Excluded</option>
								<option value="whitelisted">Always detect</option>
								<option value="eligible">Eligible now</option>
								<option value="ineligible">Outside range</option>
							</select>
						</label>
					</div>
					<SpeciesControlTools
						onImport={importLists}
						onExport={exportLists}
						onReset={() => setDialog("reset")}
					/>
				</div>
				<div className="mt-3 flex min-h-8 flex-wrap items-center gap-2 border-[var(--line)] border-y py-2">
					<ListFilter className="size-4 text-muted-foreground" />
					<span className="text-muted-foreground text-xs">
						{selected.size
							? `${selected.size} selected`
							: "Select species for bulk changes"}
					</span>
					<Button
						disabled={!selected.size}
						size="xs"
						variant="outline"
						onClick={() => applyBulk("custom")}
					>
						Add to Custom
					</Button>
					<Button
						disabled={!selected.size}
						size="xs"
						variant="outline"
						onClick={() => applyBulk("always")}
					>
						Always detect
					</Button>
					<Button
						disabled={!selected.size}
						size="xs"
						variant="outline"
						onClick={() => applyBulk("automatic")}
					>
						Automatic
					</Button>
					<Button
						disabled={!selected.size}
						size="xs"
						variant="outline"
						onClick={() => applyBulk("never")}
					>
						Never detect
					</Button>
				</div>
				<SpeciesControlTable
					rows={pagedRows}
					page={safePage}
					pageCount={pageCount}
					total={filtered.length}
					selected={selected}
					onSelectedChange={setSelected}
					onCustomChange={toggleCustom}
					onPolicyChange={updatePolicy}
					onHistory={openHistory}
					onPageChange={setPage}
				/>
			</section>

			{unresolvedCount > 0 ? (
				<section
					aria-label="Unmatched list entries"
					className="feature-card rounded-md p-4"
				>
					<div className="flex items-start gap-3">
						<CircleAlert className="mt-0.5 size-5 text-[var(--clay)]" />
						<div>
							<h2 className="display-title font-semibold">
								Unmatched list entries
							</h2>
							<p className="mt-1 text-muted-foreground text-sm">
								These existing lines do not match the installed model. They stay
								in place unless you remove them here.
							</p>
						</div>
					</div>
					<div className="mt-3 space-y-2">
						{(
							Object.entries(initialData.unresolved) as [
								"custom" | "excluded" | "whitelisted",
								string[],
							][]
						).flatMap(([list, values]) =>
							values.map((raw) => {
								const key = `${list}\0${raw}`;
								return removeUnresolved.has(key) ? null : (
									<div
										key={key}
										className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2"
									>
										<div>
											<span className="island-kicker">{list}</span>
											<code className="ml-2">{raw}</code>
										</div>
										<Button
											aria-label={`Remove ${raw}`}
											size="icon-xs"
											variant="ghost"
											onClick={() =>
												setRemoveUnresolved((current) =>
													new Set(current).add(key),
												)
											}
										>
											<X />
										</Button>
									</div>
								);
							}),
						)}
					</div>
				</section>
			) : null}

			{pendingCount > 0 ? (
				<div className="sticky bottom-3 z-20 flex items-center justify-between gap-3 rounded-md border border-[var(--hover-line)] bg-[color-mix(in_oklab,var(--paper-raised)_94%,var(--sage))] p-3 shadow-lg">
					<div>
						<p className="font-semibold text-sm">
							{pendingCount} pending change{pendingCount === 1 ? "" : "s"}
						</p>
						<p className="text-muted-foreground text-xs">
							Nothing changes on the recorder until you save.
						</p>
					</div>
					<div className="flex gap-2">
						<Button size="sm" variant="outline" onClick={discard}>
							Discard
						</Button>
						<Button
							disabled={!onSave}
							size="sm"
							onClick={() => setDialog("save")}
						>
							<Save />
							Review and save
						</Button>
					</div>
				</div>
			) : null}

			{dialog === "save" ? (
				<SpeciesControlDialog
					title="Save species controls?"
					description={`${pendingCount} staged change${pendingCount === 1 ? "" : "s"} will apply to new recordings immediately. No restart is required.`}
					confirmLabel="Save changes"
					pending={pending}
					onCancel={() => setDialog(null)}
					onConfirm={save}
				/>
			) : null}
			{dialog === "reset" ? (
				<SpeciesControlDialog
					title="Reset all species lists?"
					description="This stages empty Custom, Excluded, and Always detect lists. You can still review and discard before saving."
					confirmLabel="Stage reset"
					destructive
					onCancel={() => setDialog(null)}
					onConfirm={() => {
						setCustom(new Set());
						setExcluded(new Set());
						setWhitelisted(new Set());
						setDialog(null);
					}}
				/>
			) : null}
			{historyPreview ? (
				<SpeciesControlDialog
					title={`Delete ${historyPreview.comName} history?`}
					description="This permanently removes its detection rows and any unshared recording and spectrogram files. Species policy lists are not changed."
					confirmLabel="Delete history"
					destructive
					pending={pending}
					onCancel={() => setHistoryPreview(null)}
					onConfirm={deleteHistory}
				>
					<HistoryDeleteDetails preview={historyPreview} />
				</SpeciesControlDialog>
			) : null}
		</div>
	);
}
