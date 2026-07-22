import { useEffect, useRef, useState } from "react";

/**
 * Re-runs `fetcher` on an interval and keeps the latest result in state.
 * Client-only by nature (useEffect never runs during SSR) -- the caller
 * supplies the loader's initial data so the first paint isn't empty.
 *
 * There's no server-push mechanism here (no WebSocket/SSE) -- this is a
 * deliberately simple poll. The underlying query is small, indexed, and
 * LIMIT-bounded, so even a Pi-class server handles a request every few
 * seconds from a handful of viewers without breaking a sweat.
 */
export function usePolledData<T>(
	fetcher: () => Promise<T>,
	initialData: T,
	intervalMs: number,
) {
	const [data, setData] = useState(initialData);
	const [lastUpdated, setLastUpdated] = useState(() => new Date());
	const fetcherRef = useRef(fetcher);
	fetcherRef.current = fetcher;

	useEffect(() => {
		let cancelled = false;

		const id = setInterval(async () => {
			try {
				const next = await fetcherRef.current();
				if (!cancelled) {
					setData(next);
					setLastUpdated(new Date());
				}
			} catch {
				// A transient failure shouldn't kill polling -- just try again
				// on the next tick.
			}
		}, intervalMs);

		return () => {
			cancelled = true;
			clearInterval(id);
		};
	}, [intervalMs]);

	return { data, lastUpdated };
}
