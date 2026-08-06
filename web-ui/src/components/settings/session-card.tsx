import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";

import { lockFn, signOutAllDevicesFn } from "~/lib/auth.ts";

export function SessionCard({
	isDefaultPassword,
}: {
	isDefaultPassword: boolean;
}) {
	const lock = useServerFn(lockFn);
	const signOutAll = useServerFn(signOutAllDevicesFn);
	const router = useRouter();
	const [error, setError] = useState<string | undefined>();
	const [lockPending, setLockPending] = useState(false);
	const [signOutPending, setSignOutPending] = useState(false);

	async function onLock() {
		setLockPending(true);
		setError(undefined);
		try {
			await lock({ data: undefined });
			await router.invalidate();
		} catch (cause) {
			console.error(cause);
			setError("Locking this browser failed. Try again.");
		} finally {
			setLockPending(false);
		}
	}

	async function onSignOutAll() {
		setSignOutPending(true);
		setError(undefined);
		try {
			await signOutAll({ data: undefined });
			await router.invalidate();
		} catch (cause) {
			console.error(cause);
			setError("Signing out all devices failed. Try again.");
		} finally {
			setSignOutPending(false);
		}
	}

	return (
		<section className="feature-card flex flex-col gap-4 rounded-md p-4">
			<h2 className="display-title font-semibold text-lg">Access</h2>

			{isDefaultPassword ? (
				// biome-ignore lint/a11y/useSemanticElements: <output> means the result of a calculation; this is a persistent configuration warning
				<div
					role="status"
					className="flex gap-2 text-destructive text-sm"
				>
					<TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
					<span>
						This station still uses the default password, so it can only be
						unlocked from your local network. Run{" "}
						<code>scripts/set_web_ui_password.sh</code> on the Pi to set your
						own.
					</span>
				</div>
			) : null}

			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					onClick={onLock}
					disabled={lockPending}
					className="rounded-md border border-[var(--line)] px-3 py-2 text-sm disabled:opacity-50"
				>
					{lockPending ? "Locking…" : "Lock this browser"}
				</button>
				<button
					type="button"
					onClick={onSignOutAll}
					disabled={signOutPending}
					className="rounded-md border border-[var(--line)] px-3 py-2 text-sm disabled:opacity-50"
				>
					{signOutPending ? "Signing out…" : "Sign out all devices"}
				</button>
			</div>
			{error ? (
				<p role="alert" className="text-destructive text-sm">
					{error}
				</p>
			) : null}
			<p className="text-muted-foreground text-xs">
				Signing out all devices also signs out this one.
			</p>
		</section>
	);
}
