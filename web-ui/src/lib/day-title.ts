/** The long form of a calendar day, e.g. "Sunday, July 28, 2026". Shared by the
    timeline masthead's out-of-range messages and the day share card. */
export function formatDayTitle(date: string): string {
	return new Date(`${date}T00:00:00`).toLocaleDateString([], {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
	});
}
