import { SlidersHorizontal } from "lucide-react";

import { PageHeaderCard } from "~/components/page-header-card.tsx";
import type { SettingsPageData } from "~/lib/settings-data.ts";
import { SettingsCards, type SettingsSavers } from "./settings-cards.tsx";

export function SettingsPage({
	data,
	savers = {},
}: {
	data: SettingsPageData;
	savers?: SettingsSavers;
}) {
	return (
		<main className="page-wrap space-y-4 py-4">
			<PageHeaderCard
				title="Settings"
				description="Configure this station without editing birdnet.conf. Each card validates and saves independently."
				stats={[
					{
						label: "Control surface",
						value: "7 independent sections",
						icon: SlidersHorizontal,
					},
				]}
			/>
			<SettingsCards data={data} savers={savers} />
		</main>
	);
}
