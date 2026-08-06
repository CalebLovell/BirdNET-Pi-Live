import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Lock } from "lucide-react";
import { useState } from "react";

import { unlockFn } from "~/lib/auth.ts";

const MESSAGES = {
	invalid: "That password is not right.",
	throttled: "Too many attempts. Wait a few minutes and try again.",
	"default-password-remote":
		"This station still uses its default password, so it can only be unlocked from the local network. Set a password with scripts/set_web_ui_password.sh.",
} as const;

/**
 * Rendered in place of a gated page's content rather than as a redirect or a
 * modal: the URL stays put, so unlocking simply turns the page into itself and
 * a bookmark to /settings still lands on /settings.
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
		} finally {
			setPending(false);
		}
	}

	return (
		<div className="mx-auto flex w-full max-w-sm flex-col items-center px-4 py-16">
			<Lock className="mb-4 size-6 text-muted-foreground" aria-hidden="true" />
			<h1 className="display-title mb-1 font-semibold text-xl">
				{title} is locked
			</h1>
			<p className="mb-6 text-center text-muted-foreground text-sm">
				Enter the station password to continue.
			</p>
			<form onSubmit={onSubmit} className="flex w-full flex-col gap-3">
				<label className="sr-only" htmlFor="station-password">
					Station password
				</label>
				<input
					id="station-password"
					type="password"
					autoComplete="current-password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					className="w-full rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-sm"
				/>
				{error ? (
					<p role="alert" className="text-destructive text-sm">
						{error}
					</p>
				) : null}
				<button
					type="submit"
					disabled={pending || password.length === 0}
					className="rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-sm disabled:opacity-50"
				>
					{pending ? "Unlocking…" : "Unlock"}
				</button>
			</form>
		</div>
	);
}
