export type Rgb = [number, number, number];

/**
 * Piecewise-linear color ramp across evenly-spaced `stops`. Kept pure and
 * stop-agnostic so callers can pass the site's own tokens (resolved from CSS
 * variables, so it adapts to the theme) and the mapping stays unit-testable
 * without a DOM. `t` is clamped to [0, 1]; `stops` must hold at least two.
 */
export function rampColor(stops: Rgb[], t: number): Rgb {
	const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
	const segments = stops.length - 1;
	const scaled = clamped * segments;
	const index = Math.min(Math.floor(scaled), segments - 1);
	const frac = scaled - index;
	const from = stops[index];
	const to = stops[index + 1];
	return [
		Math.round(from[0] + (to[0] - from[0]) * frac),
		Math.round(from[1] + (to[1] - from[1]) * frac),
		Math.round(from[2] + (to[2] - from[2]) * frac),
	];
}
