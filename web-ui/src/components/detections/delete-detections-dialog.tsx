import { Button } from "~/components/ui/button.tsx";

type DeleteDetectionsDialogProps = {
	count: number;
	pending: boolean;
	onCancel: () => void;
	onConfirm: () => void;
};

export function DeleteDetectionsDialog({
	count,
	pending,
	onCancel,
	onConfirm,
}: DeleteDetectionsDialogProps) {
	return (
		<div
			aria-labelledby="delete-detections-title"
			aria-modal="true"
			className="fixed inset-0 z-50 grid place-items-center bg-black/20 p-4"
			role="alertdialog"
		>
			<div className="feature-card w-full max-w-md rounded-md p-4 shadow-xl">
				<div className="space-y-2">
					<h2 id="delete-detections-title" className="text-lg font-semibold">
						Delete {count} detection{count === 1 ? "" : "s"}?
					</h2>
					<p className="text-sm text-muted-foreground">
						This permanently removes {count} detection record
						{count === 1 ? "" : "s"} and their unreferenced extracted audio
						files. This cannot be undone.
					</p>
				</div>
				<div className="mt-4 flex justify-end gap-2">
					<Button variant="outline" onClick={onCancel} disabled={pending}>
						Cancel
					</Button>
					<Button variant="destructive" onClick={onConfirm} disabled={pending}>
						{pending
							? "Deleting…"
							: `Delete ${count} detection${count === 1 ? "" : "s"}`}
					</Button>
				</div>
			</div>
		</div>
	);
}
