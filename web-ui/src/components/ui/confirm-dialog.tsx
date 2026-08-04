import { TriangleAlert } from "lucide-react";
import { type ReactNode, useEffect, useId } from "react";

import { Button } from "~/components/ui/button.tsx";

/**
 * The station's one confirmation dialog: a question, the consequences under it,
 * and the two ways out. Grown out of the species control dialog, which was the
 * most complete of the three hand-rolled copies.
 *
 * Both buttons are explicitly `type="button"`. The dialog is often rendered
 * inside the form whose submission it is gating -- a settings card does exactly
 * this -- and a bare button there defaults to `submit`, so confirming would
 * submit the form a second time behind the handler's back.
 */
export function ConfirmDialog({
	title,
	description,
	children,
	confirmLabel,
	cancelLabel = "Cancel",
	destructive = false,
	pending = false,
	onCancel,
	onConfirm,
}: {
	title: string;
	description: string;
	/** Detail between the description and the buttons, e.g. a preview. */
	children?: ReactNode;
	confirmLabel: string;
	cancelLabel?: string;
	destructive?: boolean;
	pending?: boolean;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	const titleId = useId();

	// Escape is the expected way out of a modal, and leaving it unhandled meant
	// the only exit was hitting a 24px Cancel button.
	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape" && !pending) onCancel();
		}
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [onCancel, pending]);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_oklab,var(--ink)_28%,transparent)] p-4">
			<section
				aria-labelledby={titleId}
				aria-modal="true"
				role="alertdialog"
				className="feature-card w-full max-w-lg rounded-md p-5 text-left shadow-xl"
			>
				<div className="flex gap-3">
					{destructive ? (
						<TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
					) : null}
					<div>
						<h2 id={titleId} className="display-title font-semibold text-lg">
							{title}
						</h2>
						<p className="mt-1 text-muted-foreground text-sm leading-relaxed">
							{description}
						</p>
					</div>
				</div>
				{children ? <div className="mt-4">{children}</div> : null}
				<div className="mt-5 flex justify-end gap-2">
					<Button
						type="button"
						disabled={pending}
						variant="outline"
						onClick={onCancel}
					>
						{cancelLabel}
					</Button>
					<Button
						type="button"
						loading={pending}
						variant={destructive ? "destructive" : "default"}
						onClick={onConfirm}
					>
						{confirmLabel}
					</Button>
				</div>
			</section>
		</div>
	);
}
