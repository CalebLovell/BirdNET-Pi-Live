import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { RowSelectionState } from "@tanstack/react-table";
import { CircleAlert, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { DeleteDetectionsDialog } from "~/components/detections/delete-detections-dialog.tsx";
import {
	DetectionsFilters,
	DetectionsTable,
} from "~/components/detections/detections-table.tsx";
import { PageHeaderCard } from "~/components/page-header-card.tsx";
import { Button } from "~/components/ui/button.tsx";
import { normalizeDetectionWorkspaceSearch } from "~/lib/detection-workspace.ts";
import { deleteDetections, getDetectionsPage } from "~/lib/detections.ts";

type Feedback = {
	message: string;
	tone: "error" | "success";
};

export const Route = createFileRoute("/detections")({
	validateSearch: (search) => normalizeDetectionWorkspaceSearch(search),
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => getDetectionsPage({ data: deps }),
	component: Detections,
});

function Detections() {
	const page = Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const router = useRouter();
	const runDeletion = useServerFn(deleteDetections);
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [feedback, setFeedback] = useState<Feedback | null>(null);
	const selectedRowIds = Object.entries(rowSelection)
		.filter(([, isSelected]) => isSelected)
		.map(([rowId]) => Number(rowId));
	const selectedCount = selectedRowIds.length;

	// `page.total` already honours the active filters; the species figure can
	// only speak for the loaded page, so its label says so.
	const stats = useMemo(() => {
		const species = new Set(page.rows.map((row) => row.Com_Name)).size;
		const pageCount = Math.max(1, Math.ceil(page.total / search.pageSize));

		return [
			{ label: "Matching detections", value: page.total },
			{ label: "Species on this page", value: species },
			{
				label: "Page",
				value: `${Math.min(search.page, pageCount)} of ${pageCount}`,
			},
		];
	}, [page, search.page, search.pageSize]);

	async function confirmDeletion() {
		setIsDeleting(true);
		setFeedback(null);

		try {
			const result = await runDeletion({ data: { rowIds: selectedRowIds } });
			setDeleteOpen(false);
			setRowSelection({});
			setFeedback({
				tone: result.failedFiles > 0 ? "error" : "success",
				message:
					result.failedFiles > 0
						? `Deleted ${result.deletedRecords} detection${result.deletedRecords === 1 ? "" : "s"}, but ${result.failedFiles} audio file${result.failedFiles === 1 ? "" : "s"} could not be removed.`
						: `Deleted ${result.deletedRecords} detection${result.deletedRecords === 1 ? "" : "s"}.`,
			});

			if (search.page > 1 && selectedCount === page.rows.length) {
				navigate({
					search: { ...search, page: search.page - 1 },
					replace: true,
				});
			}

			await router.invalidate();
		} catch {
			setFeedback({
				tone: "error",
				message: "Unable to delete the selected detections. Please try again.",
			});
		} finally {
			setIsDeleting(false);
		}
	}

	return (
		<div className="page-wrap space-y-4 py-4">
			<div className="space-y-4">
				<PageHeaderCard
					title="Detections"
					description="Browse, filter, and manage every individual detection."
					stats={stats}
				/>

				<DetectionsFilters
					search={search}
					onSearchChange={(nextSearch) => {
						setRowSelection({});
						navigate({ search: nextSearch, replace: true });
					}}
				/>

				{feedback ? (
					<p
						className={
							feedback.tone === "error"
								? "flex items-center gap-2 text-destructive text-sm"
								: "text-muted-foreground text-sm"
						}
					>
						{feedback.tone === "error" ? (
							<CircleAlert className="size-4" />
						) : null}
						{feedback.message}
					</p>
				) : null}

				<section
					aria-label="Detections"
					className="feature-card rounded-md p-3"
				>
					<div className="mb-3 flex items-center justify-between gap-2">
						<div className="island-kicker">All detections</div>
						<Button
							disabled={selectedCount === 0}
							size="xs"
							variant={selectedCount > 0 ? "destructive" : "outline"}
							onClick={() => setDeleteOpen(true)}
						>
							<Trash2 />
							{selectedCount > 0 ? `Delete ${selectedCount}` : "Delete"}
						</Button>
					</div>
					<DetectionsTable
						page={page}
						search={search}
						onSearchChange={(nextSearch) =>
							navigate({ search: nextSearch, replace: true })
						}
						rowSelection={rowSelection}
						onRowSelectionChange={setRowSelection}
					/>
				</section>

				{deleteOpen ? (
					<DeleteDetectionsDialog
						count={selectedCount}
						pending={isDeleting}
						onCancel={() => setDeleteOpen(false)}
						onConfirm={confirmDeletion}
					/>
				) : null}
			</div>
		</div>
	);
}
