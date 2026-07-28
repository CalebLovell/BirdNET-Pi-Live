import { CheckCircle2, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { PageHeaderCard } from "~/components/page-header-card.tsx";
import type { SettingsPageData } from "~/lib/settings-data.ts";
import { SettingsCards, type SettingsSavers } from "./settings-cards.tsx";
import { SettingsReset } from "./settings-reset.tsx";

export function SettingsPage({
	data,
	savers = {},
	onReset,
}: {
	data: SettingsPageData;
	savers?: SettingsSavers;
	/** Resolves with the message to report. Omit to hide the reset control. */
	onReset?: () => Promise<string>;
}) {
	const [resetMessage, setResetMessage] = useState<string | null>(null);

	// Each card seeds its own state from `data` once, so a reset that only
	// refetched would leave six forms showing the values it just discarded.
	// Keying on the loaded values themselves remounts them when -- and only
	// when -- new ones actually arrive; a counter bumped alongside the refetch
	// races it, and remounts against data that has not landed yet.
	const loadedValues = JSON.stringify([
		data.station,
		data.detection,
		data.privacy,
		data.audio,
		data.recording,
		data.storage,
	]);

	return (
		<main className="page-wrap space-y-4 py-4">
			<PageHeaderCard
				title="Settings"
				description="Configure this station without editing birdnet.conf. Each card validates and saves independently."
				stats={[
					{
						label: "Control surface",
						value: "6 independent sections",
						icon: SlidersHorizontal,
					},
				]}
				action={
					onReset ? (
						<SettingsReset
							onReset={async () => {
								const message = await onReset();
								setResetMessage(message);
								return message;
							}}
						/>
					) : undefined
				}
			>
				{resetMessage ? (
					<p
						aria-live="polite"
						className="mt-4 flex items-center gap-2 border-[var(--line)] border-t pt-4 text-muted-foreground text-xs"
					>
						<CheckCircle2 aria-hidden="true" className="size-3.5" />
						{resetMessage}
					</p>
				) : null}
			</PageHeaderCard>
			<SettingsCards key={loadedValues} data={data} savers={savers} />
		</main>
	);
}
