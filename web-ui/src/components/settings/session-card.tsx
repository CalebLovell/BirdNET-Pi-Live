import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { TriangleAlert } from "lucide-react";

import { lockFn, signOutAllDevicesFn } from "~/lib/auth.ts";

export function SessionCard({
	isDefaultPassword,
}: {
	isDefaultPassword: boolean;
}) {
	const lock = useServerFn(lockFn);
	const signOutAll = useServerFn(signOutAllDevicesFn);
	const router = useRouter();

	return (
		<section className="feature-card flex flex-col gap-4 rounded-md p-4">
			<h2 className="display-title font-semibold text-lg">Access</h2>

			{isDefaultPassword ? (
				<output className="flex gap-2 text-destructive text-sm">
					<TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
					<span>
						This station still uses the default password, so it can only be
						unlocked from your local network. Run{" "}
						<code>scripts/set_web_ui_password.sh</code> on the Pi to set your
						own.
					</span>
				</output>
			) : null}

			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					onClick={async () => {
						await lock({ data: undefined });
						await router.invalidate();
					}}
					className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"
				>
					Lock this browser
				</button>
				<button
					type="button"
					onClick={async () => {
						await signOutAll({ data: undefined });
						await router.invalidate();
					}}
					className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"
				>
					Sign out all devices
				</button>
			</div>
			<p className="text-muted-foreground text-xs">
				Signing out all devices also signs out this one.
			</p>
		</section>
	);
}
