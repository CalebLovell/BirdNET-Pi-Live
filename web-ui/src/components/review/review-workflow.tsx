import {
	ExternalLink,
	Search,
	ShieldCheck,
	Shuffle,
	SkipForward,
	Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ConfidencePill } from "~/components/confidence-pill.tsx";
import { RecordingButton } from "~/components/recording-button.tsx";
import { Button } from "~/components/ui/button.tsx";
import { Input } from "~/components/ui/input.tsx";
import type { ReviewCandidate, ReviewPage } from "~/lib/review.server.ts";
import type { SpeciesOption } from "~/lib/review-data.ts";

type Action =
	| { kind: "correct"; row: ReviewCandidate }
	| { kind: "delete"; row: ReviewCandidate }
	| { kind: "recategorize"; row: ReviewCandidate; species: SpeciesOption };

export function ReviewWorkflow({
	page,
	species,
	busy,
	onCorrect,
	onRecategorize,
	onDelete,
	onLoadMore,
}: {
	page: ReviewPage;
	species: SpeciesOption[];
	busy: boolean;
	onCorrect: (rowId: number) => Promise<void>;
	onRecategorize: (rowId: number, species: SpeciesOption) => Promise<void>;
	onDelete: (rowId: number) => Promise<void>;
	onLoadMore: () => void;
}) {
	const [index, setIndex] = useState(0);
	const [skipped, setSkipped] = useState<Set<number>>(new Set());
	const [action, setAction] = useState<Action | null>(null);
	const [picker, setPicker] = useState<ReviewCandidate | null>(null);
	const [query, setQuery] = useState("");
	const rows = page.candidates.filter((row) => !skipped.has(row.rowId));
	const row = rows[Math.min(index, Math.max(0, rows.length - 1))];
	const matches = useMemo(() => {
		const q = query.trim().toLowerCase();
		return (
			q
				? species.filter((s) =>
						`${s.comName} ${s.sciName}`.toLowerCase().includes(q),
					)
				: species
		).slice(0, 100);
	}, [query, species]);
	async function confirm() {
		if (!action) return;
		if (action.kind === "correct") await onCorrect(action.row.rowId);
		else if (action.kind === "delete") await onDelete(action.row.rowId);
		else await onRecategorize(action.row.rowId, action.species);
		setAction(null);
		setIndex(0);
	}
	if (!row)
		return (
			<section className="feature-card rounded-md p-8 text-center">
				<h2 className="display-title font-semibold text-xl">All caught up</h2>
				<p className="mt-2 text-muted-foreground text-sm">
					No more recordings in this batch.
				</p>
				{page.candidates.length >= page.limit && page.limit < 200 ? (
					<Button className="mt-4" onClick={onLoadMore}>
						Load more
					</Button>
				) : null}
			</section>
		);
	return (
		<>
			<section className="feature-card overflow-hidden rounded-md">
				<div className="border-b bg-[color-mix(in_oklab,var(--sage)_18%,transparent)] p-4">
					<div className="flex items-start justify-between gap-4">
						<div>
							<div className="island-kicker">
								Recording {index + 1} of {rows.length}
							</div>
							<h2 className="display-title mt-1 font-bold text-2xl">
								{row.comName}
							</h2>
							<em className="text-[var(--bark)] text-sm">{row.sciName}</em>
						</div>
						<ConfidencePill confidence={row.confidence} />
					</div>
				</div>
				<div className="grid gap-6 p-4 md:grid-cols-[1fr_auto] md:items-center">
					<div>
						<p className="tabular-data text-muted-foreground text-sm">
							{row.date} · {row.time}
						</p>
						<p className="mt-2 text-sm">
							{page.queue === "rare"
								? `${row.lifetimeCount} lifetime detection${row.lifetimeCount === 1 ? "" : "s"}`
								: "One of the station’s lowest-confidence matches"}
						</p>
						<div className="mt-4 flex flex-wrap items-center gap-2">
							<RecordingButton
								audioUrl={row.audioAvailable ? row.audioUrl : null}
							/>
							<Button asChild variant="outline" size="sm">
								<a
									href={row.ebirdUrl}
									target="_blank"
									rel="noreferrer"
									aria-label="Open eBird reference"
								>
									<ExternalLink />
									eBird reference
								</a>
							</Button>
						</div>
						{!row.audioAvailable ? (
							<p className="mt-3 text-destructive text-sm">
								Audio unavailable. You can delete or skip this orphaned entry.
							</p>
						) : null}
					</div>
					<div className="grid min-w-48 gap-2">
						<Button
							disabled={!row.audioAvailable || busy}
							onClick={() => setAction({ kind: "correct", row })}
						>
							<ShieldCheck />
							Correct
						</Button>
						<Button
							variant="outline"
							disabled={!row.audioAvailable || busy}
							onClick={() => setPicker(row)}
						>
							<Shuffle />
							Recategorize
						</Button>
						<Button
							variant="destructive"
							disabled={busy}
							onClick={() => setAction({ kind: "delete", row })}
						>
							<Trash2 />
							Delete
						</Button>
						<Button
							variant="ghost"
							disabled={busy}
							onClick={() => {
								setSkipped(new Set(skipped).add(row.rowId));
								setIndex(0);
							}}
						>
							<SkipForward />
							Skip
						</Button>
					</div>
				</div>
			</section>
			{picker ? (
				<div
					role="dialog"
					aria-modal="true"
					aria-label="Recategorize detection"
					className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
				>
					<div className="feature-card max-h-[80vh] w-full max-w-xl overflow-hidden rounded-md p-4">
						<h2 className="display-title font-semibold text-xl">
							Choose the correct species
						</h2>
						<div className="relative mt-4">
							<Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
							<Input
								className="pl-9"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Search any BirdNET species"
								autoFocus
							/>
						</div>
						<div className="mt-3 max-h-80 space-y-1 overflow-auto">
							{matches.map((item) => (
								<button
									type="button"
									className="w-full rounded-md px-3 py-2 text-left hover:bg-accent"
									key={item.sciName}
									onClick={() => {
										setAction({
											kind: "recategorize",
											row: picker,
											species: item,
										});
										setPicker(null);
									}}
								>
									<span className="font-medium">{item.comName}</span>
									<span className="ml-2 text-muted-foreground text-xs italic">
										{item.sciName}
									</span>
								</button>
							))}
						</div>
						<Button
							className="mt-3"
							variant="outline"
							onClick={() => setPicker(null)}
						>
							Cancel
						</Button>
					</div>
				</div>
			) : null}
			{action ? (
				<div
					role="alertdialog"
					aria-modal="true"
					aria-labelledby="confirm-review-title"
					className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
				>
					<div className="feature-card w-full max-w-md rounded-md p-4 shadow-xl">
						<h2
							id="confirm-review-title"
							className="display-title font-semibold text-xl"
						>
							Confirm correction
						</h2>
						<p className="mt-2 text-muted-foreground text-sm">
							{action.kind === "correct"
								? `Mark ${action.row.comName} as correct at 100% confidence?`
								: action.kind === "delete"
									? `Permanently delete this ${action.row.comName} detection and its unreferenced audio?`
									: `Change ${action.row.comName} to ${action.species.comName} and mark it 100% confident?`}
						</p>
						<div className="mt-4 flex justify-end gap-2">
							<Button
								variant="outline"
								disabled={busy}
								onClick={() => setAction(null)}
							>
								Cancel
							</Button>
							<Button
								variant={action.kind === "delete" ? "destructive" : "default"}
								disabled={busy}
								onClick={confirm}
							>
								{busy
									? "Saving…"
									: action.kind === "delete"
										? "Delete detection"
										: "Confirm correction"}
							</Button>
						</div>
					</div>
				</div>
			) : null}
		</>
	);
}
