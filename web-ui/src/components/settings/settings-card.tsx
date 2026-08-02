import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, LoaderCircle, Save } from "lucide-react";
import type { FormEvent, ReactNode } from "react";

import { Button } from "~/components/ui/button.tsx";

export type CardSaveState = "idle" | "saving" | "saved" | "warning" | "error";

const edgeClasses: Record<CardSaveState, string> = {
	idle: "border-l-[var(--sage)]",
	saving: "border-l-[var(--sand)]",
	saved: "border-l-[var(--moss)]",
	warning: "border-l-[var(--sand)]",
	error: "border-l-destructive",
};

export function SettingsCard({
	title,
	description,
	icon: Icon,
	state,
	message,
	onSubmit,
	action,
	restart,
	saveDisabled,
	children,
}: {
	title: string;
	description: string;
	icon: LucideIcon;
	state: CardSaveState;
	message?: string;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	/**
	 * A control for the card as a whole, set against its title. It sits inside
	 * the card's form, so anything interactive here needs `type="button"` --
	 * a bare button would submit the card.
	 */
	action?: ReactNode;
	/** Offered beside Save while the saved values are not the running ones. */
	restart?: ReactNode;
	/**
	 * True while the card holds nothing worth saving -- either it is mid-save,
	 * or nothing has been changed since the values it was given.
	 */
	saveDisabled?: boolean;
	children: ReactNode;
}) {
	return (
		<section
			aria-labelledby={`settings-${title.toLowerCase().replaceAll(" ", "-")}`}
			className={`feature-card overflow-hidden rounded-md border-l-4 ${edgeClasses[state]}`}
		>
			<form onSubmit={onSubmit} className="flex h-full flex-col">
				{/* Centred, not top-aligned: the disc reads against the whole title
				    block, and hanging it off the first line left it sitting a few
				    pixels high of the space it occupies. */}
				<header className="flex items-center gap-3 border-b p-4">
					<div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--sage)_30%,var(--paper-raised))]">
						<Icon aria-hidden="true" className="size-4 text-[var(--moss)]" />
					</div>
					<div className="min-w-0">
						<h2
							id={`settings-${title.toLowerCase().replaceAll(" ", "-")}`}
							className="display-title font-semibold text-lg leading-tight"
						>
							{title}
						</h2>
						<p className="mt-1 text-muted-foreground text-sm leading-relaxed">
							{description}
						</p>
					</div>
					{action ? <div className="ml-auto shrink-0">{action}</div> : null}
				</header>

				<div className="flex-1 space-y-4 p-4">{children}</div>

				{/* No min-height: it existed to stop the footer collapsing around the
				    standing note, and p-4 around the button now sets the height on
				    its own. */}
				<footer className="flex items-center justify-between gap-4 border-t p-4">
					<div
						aria-live="polite"
						className={`flex min-w-0 items-center gap-2 text-xs ${
							state === "error"
								? "text-destructive"
								: state === "warning"
									? "text-[var(--bark)]"
									: "text-muted-foreground"
						}`}
					>
						{/* Nothing at rest. The card has no news until it has some, and
						    a standing note explaining that cards save separately was
						    read once and then permanently in the way. */}
						{message ? (
							<>
								{state === "saving" ? (
									<LoaderCircle
										aria-hidden="true"
										className="size-3.5 animate-spin"
									/>
								) : state === "saved" ? (
									<CheckCircle2 aria-hidden="true" className="size-3.5" />
								) : state === "warning" || state === "error" ? (
									<AlertTriangle aria-hidden="true" className="size-3.5" />
								) : null}
								<span>{message}</span>
							</>
						) : null}
					</div>
					<div className="flex shrink-0 items-center gap-2">
						{restart}
						<Button type="submit" disabled={saveDisabled}>
							<Save aria-hidden="true" />
							Save
						</Button>
					</div>
				</footer>
			</form>
		</section>
	);
}
