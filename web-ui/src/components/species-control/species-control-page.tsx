import Fuse from "fuse.js";
import {
	CircleAlert,
	List,
	ListChecks,
	ListFilter,
	Save,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeaderCard } from "~/components/page-header-card.tsx";
import { Button } from "~/components/ui/button.tsx";
import { InfoTip } from "~/components/ui/info-tip.tsx";
import { SearchInput } from "~/components/ui/search-input.tsx";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group.tsx";
import {
	applySpeciesPolicy,
	type SpeciesControlPageData,
	type SpeciesControlSaveInput,
	type SpeciesPolicy,
} from "~/lib/species-control-data.ts";
import { SpeciesControlDialog } from "./species-control-dialogs.tsx";
import {
	SpeciesControlTable,
	type SpeciesControlViewRow,
	type SpeciesSortKey,
} from "./species-control-table.tsx";
import { SpeciesControlTools } from "./species-control-tools.tsx";

type PageAdapters = {
	onSave?: (input: SpeciesControlSaveInput) => Promise<{ revision: string }>;
	onCommitted?: () => void | Promise<void>;
};

/**
 * BirdNET has no scope setting of its own -- it restricts itself precisely when
 * the Custom list is non-empty. The mode is therefore a view over that list
 * rather than a separate stored flag, and leaving Custom mode has to empty the
 * list. The departing list is stashed so returning is not a retyping exercise.
 */
type Scope = "normal" | "custom";

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
	const [sort, setSort] = useState<SpeciesSortKey>("species");
	const [reverse, setReverse] = useState(false);
	const [page, setPage] = useState(1);
	const [selected, setSelected] = useState(new Set<string>());
	const [removeUnresolved, setRemoveUnresolved] = useState(new Set<string>());
	const [dialog, setDialog] = useState<"save" | "reset" | null>(null);
	const [scope, setScope] = useState<Scope>(() =>
		initialData.customMode ? "custom" : "normal",
	);
	const [stashedCustom, setStashedCustom] = useState(() => new Set<string>());
	const [pending, setPending] = useState(false);
	const [feedback, setFeedback] = useState<{
		tone: "error" | "success";
		message: string;
	} | null>(null);

	// What BirdNET will actually do once saved, which is not the same as the
	// scope on screen: Custom scope with nothing ticked still behaves as Normal.
	// Only the policy edits read this now; the table states the policy alone.
	const customMode = custom.size > 0;
	const emptyCustomScope = scope === "custom" && custom.size === 0;
	const pendingCount =
		changedCount(custom, baseline.custom) +
		changedCount(excluded, baseline.excluded) +
		changedCount(whitelisted, baseline.whitelisted) +
		removeUnresolved.size;
	const viewRows = useMemo<SpeciesControlViewRow[]>(
		() =>
			initialData.rows.map((row) => {
				const policy: SpeciesPolicy = excluded.has(row.sciName)
					? "never"
					: whitelisted.has(row.sciName)
						? "always"
						: "automatic";
				return {
					...row,
					custom: custom.has(row.sciName),
					excluded: excluded.has(row.sciName),
					whitelisted: whitelisted.has(row.sciName),
					policy,
				};
			}),
		[custom, excluded, initialData.rows, whitelisted],
	);
	const searched = useMemo(() => {
		if (!query.trim()) return viewRows;
		return new Fuse(viewRows, { keys: ["comName", "sciName"], threshold: 0.3 })
			.search(query.trim())
			.map((result) => result.item);
	}, [query, viewRows]);
	const sorted = useMemo(() => {
		const direction = reverse ? -1 : 1;
		// Ranked rather than compared by label so the order reads as a scale from
		// least to most intervention, not as an alphabetical accident.
		const policyRank = { automatic: 0, always: 1, never: 2 };
		return [...searched].sort((a, b) => {
			if (sort === "count")
				return (
					direction * (b.history.detections - a.history.detections) ||
					a.comName.localeCompare(b.comName)
				);
			if (sort === "policy")
				return (
					direction * (policyRank[a.policy] - policyRank[b.policy]) ||
					a.comName.localeCompare(b.comName)
				);
			return direction * a.comName.localeCompare(b.comName);
		});
	}, [searched, sort, reverse]);
	const pageCount = Math.max(1, Math.ceil(sorted.length / 50));
	const safePage = Math.min(page, pageCount);
	const pagedRows = sorted.slice((safePage - 1) * 50, safePage * 50);
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

	function changeSort(key: SpeciesSortKey) {
		if (key === sort) setReverse((current) => !current);
		else {
			setSort(key);
			setReverse(false);
		}
		setPage(1);
	}

	function switchScope(next: Scope) {
		if (next === scope) return;
		if (next === "normal") {
			setStashedCustom(new Set(custom));
			setCustom(new Set());
		} else {
			setCustom(new Set(stashedCustom));
		}
		setScope(next);
		setPage(1);
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
			/>

			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<SearchInput
					aria-label="Search installed species"
					placeholder="Search species control..."
					value={query}
					onChange={(event) => {
						setQuery(event.target.value);
						setPage(1);
					}}
					onClear={() => {
						setQuery("");
						setPage(1);
					}}
				/>
				{/* Scrolls rather than wraps on a narrow screen: a segmented control
				    cannot break across lines without losing its joined shape. */}
				<div className="-mx-1 flex max-w-full shrink-0 items-center gap-2 overflow-x-auto px-1 py-1">
					<ToggleGroup
						aria-label="Detection scope"
						type="single"
						variant="outline"
						value={scope}
						// Radix clears the value when the active item is pressed
						// again; scope is never absent, so that press is ignored.
						onValueChange={(value) => {
							if (value) switchScope(value as Scope);
						}}
					>
						<ToggleGroupItem value="normal" aria-label="Normal scope">
							<List className="size-4" />
							Normal
						</ToggleGroupItem>
						<ToggleGroupItem value="custom" aria-label="Custom scope">
							<ListChecks className="size-4" />
							Custom
						</ToggleGroupItem>
					</ToggleGroup>
				</div>
			</div>

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
				aria-label="Installed species"
				className="feature-card rounded-md p-4"
			>
				<div className="mb-3 flex items-center justify-between gap-2">
					<div className="flex items-center gap-1.5">
						<div className="island-kicker">Installed species</div>
						<InfoTip label="Installed species">
							<p>
								<strong>Normal</strong> scope lets any installed species be
								detected unless you exclude it. <strong>Custom</strong> scope
								flips that: only the species you tick can be detected.
								Exclusions still win either way.
							</p>
							<p>
								Leaving Custom scope empties the list, but your picks are
								remembered — switching back restores them, and nothing reaches
								the recorder until you save.
							</p>
							<p>
								Per species, <strong>Automatic</strong> leaves the call to
								BirdNET, <strong>Always detect</strong> skips its
								species-frequency check, and <strong>Never detect</strong> drops
								the species outright.
							</p>
						</InfoTip>
					</div>
					<SpeciesControlTools
						onImport={importLists}
						onExport={exportLists}
						onReset={() => setDialog("reset")}
					/>
				</div>

				{/* A warning about live state, not documentation, so it stays on the
				    page rather than moving into the tooltip above. */}
				{emptyCustomScope ? (
					<p className="mb-3 text-[var(--clay)] text-xs">
						Nothing is ticked yet, so BirdNET keeps behaving as Normal until you
						choose at least one species.
					</p>
				) : null}
				{scope === "normal" && stashedCustom.size > 0 ? (
					<p className="mb-3 text-muted-foreground text-xs">
						Switching back to Custom restores the{" "}
						{stashedCustom.size.toLocaleString()} species you had chosen.
					</p>
				) : null}
				<div className="mt-3 flex min-h-8 flex-wrap items-center gap-2 border-[var(--line)] border-y py-2">
					<ListFilter className="size-4 text-muted-foreground" />
					<span className="text-muted-foreground text-xs">
						{selected.size
							? `${selected.size} selected`
							: "Select species for bulk changes"}
					</span>
					{scope === "custom" ? (
						<Button
							disabled={!selected.size}
							size="xs"
							variant="outline"
							onClick={() => applyBulk("custom")}
						>
							Add to Custom
						</Button>
					) : null}
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
					total={sorted.length}
					selected={selected}
					sort={sort}
					reverse={reverse}
					onSortChange={changeSort}
					onSelectedChange={setSelected}
					onCustomChange={toggleCustom}
					onPolicyChange={updatePolicy}
					onPageChange={setPage}
					showCustom={scope === "custom"}
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
						<Button size="xs" variant="outline" onClick={discard}>
							Discard
						</Button>
						<Button
							disabled={!onSave}
							size="xs"
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
		</div>
	);
}
