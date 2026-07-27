import { useEffect, useSyncExternalStore } from "react";

/**
 * When the station last reported in, published by whichever page is polling it
 * and read by the footer.
 *
 * The footer renders outside the route tree, so the timestamp cannot travel to
 * it as a prop. A module-scoped store is the whole mechanism: the polling page
 * pushes each snapshot's time in, the footer subscribes, and nothing in between
 * has to know either of them exists.
 */
let generatedAt: string | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function publish(value: string | null): void {
	if (value === generatedAt) return;
	generatedAt = value;
	for (const listener of listeners) listener();
}

/**
 * Null on the server and through hydration -- the footer is shared by every
 * page, and only the polling one has a time to show. It fills in on the first
 * client render rather than shipping a timestamp the other pages contradict.
 */
export function useLiveStatus(): string | null {
	return useSyncExternalStore(
		subscribe,
		() => generatedAt,
		() => null,
	);
}

/**
 * Publishes for as long as the calling page is mounted. Navigating away clears
 * it, so the footer stops claiming a freshness nothing is refreshing.
 */
export function usePublishLiveStatus(value: string): void {
	useEffect(() => {
		publish(value);
		return () => publish(null);
	}, [value]);
}
