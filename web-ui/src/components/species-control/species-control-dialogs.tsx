import { Loader2, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "~/components/ui/button.tsx";
import type { HistoryDeletePreview } from "~/lib/species-control-data.ts";

export function SpeciesControlDialog({
	title,
	description,
	children,
	confirmLabel,
	destructive = false,
	pending = false,
	onCancel,
	onConfirm,
}: {
	title: string;
	description: string;
	children?: ReactNode;
	confirmLabel: string;
	destructive?: boolean;
	pending?: boolean;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_oklab,var(--ink)_28%,transparent)] p-4">
			<section
				aria-labelledby="species-control-dialog-title"
				aria-modal="true"
				role="alertdialog"
				className="feature-card w-full max-w-lg rounded-md p-5 shadow-xl"
			>
				<div className="flex gap-3">
					{destructive ? (
						<TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
					) : null}
					<div>
						<h2
							id="species-control-dialog-title"
							className="display-title font-semibold text-lg"
						>
							{title}
						</h2>
						<p className="mt-1 text-muted-foreground text-sm">{description}</p>
					</div>
				</div>
				{children ? <div className="mt-4">{children}</div> : null}
				<div className="mt-5 flex justify-end gap-2">
					<Button disabled={pending} variant="outline" onClick={onCancel}>
						Cancel
					</Button>
					<Button
						disabled={pending}
						variant={destructive ? "destructive" : "default"}
						onClick={onConfirm}
					>
						{pending ? <Loader2 className="animate-spin" /> : null}
						{confirmLabel}
					</Button>
				</div>
			</section>
		</div>
	);
}

export function HistoryDeleteDetails({
	preview,
}: {
	preview: HistoryDeletePreview;
}) {
	return (
		<dl className="grid grid-cols-3 gap-2 rounded-md bg-muted p-3 text-center">
			<div>
				<dt className="text-muted-foreground text-xs">Detections</dt>
				<dd className="tabular-data mt-1 font-semibold">{preview.rows}</dd>
			</div>
			<div>
				<dt className="text-muted-foreground text-xs">Recordings</dt>
				<dd className="tabular-data mt-1 font-semibold">
					{preview.recordings}
				</dd>
			</div>
			<div>
				<dt className="text-muted-foreground text-xs">Files found</dt>
				<dd className="tabular-data mt-1 font-semibold">{preview.assets}</dd>
			</div>
		</dl>
	);
}
