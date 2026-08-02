import type { LucideIcon } from "lucide-react";
import { Database, HardDrive, Radio } from "lucide-react";

import type {
	PageHeaderStat,
	StatTone,
} from "~/components/page-header-card.tsx";
import type {
	HealthLevel,
	HealthMetricId,
	StationHealth,
} from "~/lib/health-data.ts";

const ICONS: Record<HealthMetricId, LucideIcon> = {
	disk: HardDrive,
	database: Database,
	"last-detection": Radio,
};

/**
 * The health vocabulary and the masthead's happen to line up one-to-one, but
 * they are not the same thing -- one describes a station, the other describes
 * a figure -- so the mapping is written down rather than assumed.
 */
const TONES: Record<HealthLevel, StatTone> = {
	ok: "ok",
	warn: "warn",
	problem: "problem",
	unknown: "unknown",
};

/**
 * The station's vital signs as masthead figures, so Settings has the same head
 * as every other page rather than a panel of its own invention.
 */
export function healthStats(health: StationHealth): PageHeaderStat[] {
	return health.metrics.map((metric) => ({
		label: metric.label,
		value: metric.value,
		detail: metric.detail,
		hint: metric.hint,
		icon: ICONS[metric.id],
		tone: TONES[metric.level],
	}));
}
