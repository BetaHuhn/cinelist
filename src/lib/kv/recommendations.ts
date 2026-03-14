import { storage } from '$storage'
import type { TMDBMediaResult } from '$lib/types/tmdb'

const PREFIX = 'recommendations'
const HOME_KEY = `${PREFIX}:home:v4`

export interface CachedRecommendations {
	cachedAt: number
	items: TMDBMediaResult[]
}

export async function getHomeRecommendationsCache(): Promise<CachedRecommendations | null> {
	return storage.getItem<CachedRecommendations>(HOME_KEY)
}

export async function setHomeRecommendationsCache(items: TMDBMediaResult[]): Promise<void> {
	const payload: CachedRecommendations = { cachedAt: Date.now(), items }
	await storage.setItem(HOME_KEY, payload)
}

export async function clearHomeRecommendationsCache(): Promise<void> {
	await storage.removeItem(HOME_KEY)
}
