export type SpeciesInfo = {
	imageUrl: string | null;
	wikipediaUrl: string;
};

type WikipediaSummary = {
	thumbnail?: { source?: string };
	content_urls?: { desktop?: { page?: string } };
};

// In-memory only -- cleared on server restart. Cheap insurance against
// hammering Wikipedia on every page load for the same handful of species.
const cache = new Map<string, SpeciesInfo>();

export async function getSpeciesInfo(commonName: string): Promise<SpeciesInfo> {
	const cached = cache.get(commonName);
	if (cached) return cached;

	const title = commonName.replaceAll(" ", "_");
	const fallback: SpeciesInfo = {
		imageUrl: null,
		wikipediaUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
	};

	try {
		const response = await fetch(
			`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
			{ signal: AbortSignal.timeout(5000) },
		);
		if (!response.ok) {
			cache.set(commonName, fallback);
			return fallback;
		}
		const data = (await response.json()) as WikipediaSummary;
		const info: SpeciesInfo = {
			imageUrl: data.thumbnail?.source ?? null,
			wikipediaUrl: data.content_urls?.desktop?.page ?? fallback.wikipediaUrl,
		};
		cache.set(commonName, info);
		return info;
	} catch {
		cache.set(commonName, fallback);
		return fallback;
	}
}
