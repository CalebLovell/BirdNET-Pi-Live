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
	children,
}: {
	title: string;
	description: string;
	icon: LucideIcon;
	state: CardSaveState;
	message?: string;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	children: ReactNode;
}) {
	return (
		<section
			aria-labelledby={`settings-${title.toLowerCase().replaceAll(" ", "-")}`}
			className={`feature-card overflow-hidden rounded-md border-l-4 ${edgeClasses[state]}`}
		>
			<form onSubmit={onSubmit} className="flex h-full flex-col">
				<header className="flex items-start gap-3 border-b px-4 py-4 sm:px-5">
					<div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--sage)_30%,var(--paper-raised))]">
						<Icon aria-hidden="true" className="size-4 text-[var(--moss)]" />
					</div>
					<div>
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
				</header>

				<div className="flex-1 space-y-4 px-4 py-5 sm:px-5">{children}</div>

				<footer className="flex min-h-16 items-center justify-between gap-4 border-t px-4 py-3 sm:px-5">
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
						<span>{message ?? "Changes in this card save separately."}</span>
					</div>
					<Button type="submit" size="sm" disabled={state === "saving"}>
						<Save aria-hidden="true" />
						Save
					</Button>
				</footer>
			</form>
		</section>
	);
}
