import { ConfirmDialog } from "~/components/ui/confirm-dialog.tsx";
import type { HistoryDeletePreview } from "~/lib/species-control-data.ts";

/** Kept as a name the workspace already reads for; the shape lives in ui now. */
export const SpeciesControlDialog = ConfirmDialog;

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
