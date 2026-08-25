/** Plain number-to-words helpers, shared by anything that writes a sentence
 * about a count. */

/** "1st", "2nd", "11th", "23rd" -- the teens are the exception the modulo
 * would otherwise get wrong. */
export function ordinal(value: number): string {
	const lastTwo = value % 100;
	if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`;

	const suffix = ["th", "st", "nd", "rd"][value % 10] ?? "th";
	return `${value}${suffix}`;
}

/** "1 detection", "1,204 detections". */
export function plural(count: number, noun: string): string {
	return `${count.toLocaleString()} ${noun}${count === 1 ? "" : "s"}`;
}
