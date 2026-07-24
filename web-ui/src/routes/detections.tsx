import { useState } from "react";
import type { RowSelectionState, VisibilityState } from "@tanstack/react-table";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CircleAlert, Trash2 } from "lucide-react";
import { DeleteDetectionsDialog } from "~/components/detections/delete-detections-dialog.tsx";
import {
	DetectionsFilters,
	DetectionsTable,
	INITIAL_DETECTION_COLUMN_VISIBILITY,
} from "~/components/detections/detections-table.tsx";
import { Button } from "~/components/ui/button.tsx";
import { deleteDetections, getDetectionsPage } from "~/lib/detections.ts";
import { normalizeDetectionWorkspaceSearch } from "~/lib/detection-workspace.ts";

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
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
		INITIAL_DETECTION_COLUMN_VISIBILITY,
	);
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [feedback, setFeedback] = useState<Feedback | null>(null);
	const selectedRowIds = Object.entries(rowSelection)
		.filter(([, isSelected]) => isSelected)
		.map(([rowId]) => Number(rowId));
	const selectedCount = selectedRowIds.length;

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
				navigate({ search: { ...search, page: search.page - 1 } });
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
		<div className="page-wrap space-y-4 pt-4">
			<div className="flex flex-col gap-1">
				<h1 className="display-title text-3xl font-semibold">Detections</h1>
				<p className="text-muted-foreground">
					{page.total.toLocaleString()} matching detection
					{page.total === 1 ? "" : "s"}
				</p>
			</div>

			<div className="space-y-4">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<DetectionsFilters
						search={search}
						onSearchChange={(nextSearch) => navigate({ search: nextSearch })}
					/>
					{selectedCount > 0 ? (
						<Button
							size="sm"
							variant="destructive"
							onClick={() => setDeleteOpen(true)}
						>
							<Trash2 />
							Delete {selectedCount}
						</Button>
					) : null}
				</div>

				{feedback ? (
					<p
						className={
							feedback.tone === "error"
								? "flex items-center gap-2 text-sm text-destructive"
								: "text-sm text-muted-foreground"
						}
					>
						{feedback.tone === "error" ? (
							<CircleAlert className="size-4" />
						) : null}
						{feedback.message}
					</p>
				) : null}

				<div className="feature-card rounded-md p-3">
					<DetectionsTable
						page={page}
						search={search}
						onSearchChange={(nextSearch) => navigate({ search: nextSearch })}
						columnVisibility={columnVisibility}
						onColumnVisibilityChange={setColumnVisibility}
						rowSelection={rowSelection}
						onRowSelectionChange={setRowSelection}
					/>
				</div>

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
