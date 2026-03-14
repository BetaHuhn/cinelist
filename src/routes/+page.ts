import { fetchTrending } from '$lib/api/tmdb'
import type { TMDBMediaResult } from '$lib/types/tmdb'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ fetch }) => {
	const trendingPromise = fetchTrending(fetch)
	const recommendedPromise = (async (): Promise<TMDBMediaResult[]> => {
		try {
			const res = await fetch('/api/recommendations?limit=24')
			if (!res.ok) return []
			return (await res.json()) as TMDBMediaResult[]
		} catch {
			return []
		}
	})()

	const [trending, recommended] = await Promise.all([trendingPromise, recommendedPromise])
	return { trending, recommended }
}
