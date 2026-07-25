export type HourActivity = { hour: number; count: number };
export type BusiestHour = HourActivity;

export function buildHourActivity(rows: HourActivity[]): HourActivity[] {
	const countByHour = new Map(rows.map((row) => [row.hour, row.count]));

	return Array.from({ length: 24 }, (_, hour) => ({
		hour,
		count: countByHour.get(hour) ?? 0,
	}));
}

export function selectBusiestHour(
	activity: HourActivity[],
): BusiestHour | null {
	return activity.reduce<BusiestHour | null>(
		(busiest, point) =>
			point.count > 0 && (!busiest || point.count > busiest.count)
				? point
				: busiest,
		null,
	);
}

export function hourLabel(hour: number): string {
	if (hour === 0) return "12 AM";
	if (hour < 12) return `${hour} AM`;
	if (hour === 12) return "12 PM";
	return `${hour - 12} PM`;
}

export function rankingBarPercent(count: number, maximum: number): number {
	if (count <= 0 || maximum <= 0) return 0;
	return Math.max(2, Math.round((count / maximum) * 100));
}
