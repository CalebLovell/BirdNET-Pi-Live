import { useEffect, useState } from "react";

/**
 * Milliseconds elapsed since the current snapshot arrived, for aging the
 * server-measured `ageMs` values it carries.
 *
 * Returns 0 during SSR *and* on the first client render, so both sides of
 * hydration compute identical ages from identical data. That is what keeps the
 * hero card from painting one state and then correcting itself a tick later:
 * the server already measured the age, so the first paint is right, and this
 * only ever refines it forward.
 *
 * Re-bases whenever `dataKey` changes -- each poll brings freshly measured ages,
 * making the previous offset obsolete.
 */
export function useAgeOffset(dataKey: string, intervalMs = 1_000): number {
	const [offsetMs, setOffsetMs] = useState(0);

	// `dataKey` is never read inside the effect -- it is the re-baseline trigger.
	// Dropping it, as the lint rule suggests, would keep measuring the offset from
	// the first snapshot's arrival, so ages would drift further out on every poll.
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-baseline trigger
	useEffect(() => {
		const arrivedAt = Date.now();
		setOffsetMs(0);
		const id = setInterval(
			() => setOffsetMs(Date.now() - arrivedAt),
			intervalMs,
		);
		return () => clearInterval(id);
	}, [dataKey, intervalMs]);

	return offsetMs;
}
