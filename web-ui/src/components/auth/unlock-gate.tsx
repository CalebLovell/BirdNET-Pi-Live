import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, KeyRound, LockKeyhole } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button.tsx";
import { Input } from "~/components/ui/input.tsx";
import { unlockFn } from "~/lib/auth.ts";

const MESSAGES = {
	invalid: "That password is not right.",
	throttled: "Too many attempts. Wait a few minutes and try again.",
	"default-password-remote":
		"This station still uses its default password, so it can only be unlocked from its own network. Run scripts/set_web_ui_password.sh on the Pi to set your own.",
} as const;

/**
 * Rendered in place of a gated page's content rather than as a redirect or a
 * modal: the URL stays put, so unlocking turns the page into itself and a
 * bookmark to /settings still lands on /settings.
 *
 * Shaped like the page-level cards a route falls back to when it cannot render
 * -- `SettingsUnavailable` and friends -- because that is what this is: the
 * page, reporting why it is not showing you anything. Narrower than those,
 * since a lone password field in a full-width card reads as a form nobody
 * finished.
 */
export function UnlockGate({ title }: { title: string }) {
	const unlock = useServerFn(unlockFn);
	const router = useRouter();
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | undefined>();
	const [pending, setPending] = useState(false);

	async function onSubmit(event: React.FormEvent) {
		event.preventDefault();
		setPending(true);
		setError(undefined);
		try {
			const result = await unlock({ data: { password } });
			if (result.ok) {
				setPassword("");
				await router.invalidate();
				return;
			}
			setError(MESSAGES[result.reason]);
		} catch (cause) {
			console.error(cause);
			setError("The station could not be reached.");
		} finally {
			setPending(false);
		}
	}

	return (
		<main className="page-wrap py-4">
			<section
				aria-labelledby="unlock-title"
				className="feature-card overflow-hidden rounded-md border-l-4 border-l-[var(--sand)]"
			>
				<header className="flex items-center gap-3 border-b p-4">
					<div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--sand)_35%,var(--paper-raised))]">
						<LockKeyhole
							aria-hidden="true"
							className="size-4 text-[var(--bark)]"
						/>
					</div>
					<div className="min-w-0">
						<h1
							id="unlock-title"
							className="display-title font-semibold text-lg leading-tight"
						>
							{title} is locked
						</h1>
						<p className="mt-1 text-muted-foreground text-sm leading-relaxed">
							This part of the station is only for whoever runs it. Detections,
							species and stats stay open to everyone.
						</p>
					</div>
				</header>

				<form className="flex flex-col gap-4 p-4" onSubmit={onSubmit}>
					{/* The same two-column field grid the settings cards use, so the
					    field is the width of a Station or Storage field rather than a
					    password box stretched across the whole content column. */}
					<div className="grid gap-4 sm:grid-cols-2">
						{/* The control is nested, so the label association is native HTML
						    even though Biome cannot see through `Input`'s boundary --
						    same as `Field` in the settings cards. */}
						{/* biome-ignore lint/a11y/noLabelWithoutControl: nested labeled control */}
						<label className="block space-y-1.5">
							<span className="flex items-center gap-1.5 font-medium text-sm">
								Station password
							</span>
							<Input
								type="password"
								autoComplete="current-password"
								// The reason anyone is on this screen is to type in this box.
								autoFocus
								value={password}
								onChange={(event) => setPassword(event.target.value)}
							/>
							<span className="block text-muted-foreground text-xs leading-relaxed">
								Set on the Pi with{" "}
								<code className="tabular-data">
									scripts/set_web_ui_password.sh
								</code>
								.
							</span>
						</label>
					</div>

					<div className="flex flex-wrap items-center justify-between gap-3">
						<p
							aria-live="polite"
							role="alert"
							className="flex min-w-0 items-start gap-2 text-destructive text-xs"
						>
							{error ? (
								<>
									<AlertTriangle
										aria-hidden="true"
										className="mt-px size-3.5 shrink-0"
									/>
									<span>{error}</span>
								</>
							) : null}
						</p>
						<Button
							type="submit"
							icon={KeyRound}
							disabled={pending || password.length === 0}
						>
							{pending ? "Unlocking…" : "Unlock"}
						</Button>
					</div>
				</form>
			</section>
		</main>
	);
}
