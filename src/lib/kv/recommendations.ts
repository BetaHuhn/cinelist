import { storage } from '$storage'
import type { TMDBMediaResult } from '$lib/types/tmdb'

const PREFIX = 'recommendations'
const HOME_KEY = `${PREFIX}:home:v5`

/** Maximum characters to store for an item's overview in the cache.
 *  Keeps each slimmed item ≈ 300 bytes so 60 items stay well under
 *  Deno KV's 64 KB per-value limit (~18 KB total). */
const MAX_OVERVIEW_LENGTH = 250

export interface CachedRecommendations {
	cachedAt: number
	items: TMDBMediaResult[]
}

export async function getHomeRecommendationsCache(): Promise<CachedRecommendations | null> {
	return storage.getItem<CachedRecommendations>(HOME_KEY)
}

/**
 * Strip verbose TMDB fields before caching to stay under Deno KV's 64 KB value limit.
 * TV shows in particular can include large `seasons[]` arrays and long overviews.
 * We keep only the fields required for card display and watchlist deduplication.
 */
function slimItem(item: TMDBMediaResult): TMDBMediaResult {
	const base = {
		id: item.id,
		overview: (item.overview ?? '').slice(0, MAX_OVERVIEW_LENGTH),
		poster_path: item.poster_path,
		backdrop_path: item.backdrop_path,
		vote_average: item.vote_average,
		vote_count: item.vote_count,
		genre_ids: item.genre_ids ?? [],
		popularity: item.popularity,
		original_language: item.original_language
	}
	if (item.media_type === 'movie') {
		return { ...base, media_type: 'movie' as const, title: item.title, release_date: item.release_date }
	}
	return { ...base, media_type: 'tv' as const, name: item.name, first_air_date: item.first_air_date }
}

export async function setHomeRecommendationsCache(items: TMDBMediaResult[]): Promise<void> {
	const payload: CachedRecommendations = { cachedAt: Date.now(), items: items.map(slimItem) }
	await storage.setItem(HOME_KEY, payload)
}

export async function clearHomeRecommendationsCache(): Promise<void> {
	await storage.removeItem(HOME_KEY)
}
