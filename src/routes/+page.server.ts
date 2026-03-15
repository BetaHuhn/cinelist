import { fetchTrending } from '$lib/api/tmdb'
import type { TMDBMediaResult } from '$lib/types/tmdb'
import type { FeaturedItem } from '$lib/types/featured'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ fetch }) => {
	const trendingPromise = fetchTrending(fetch)
	const featuredPromise = (async (): Promise<FeaturedItem[]> => {
		try {
			const res = await fetch('/api/featured?limit=8')
			if (!res.ok) return []
			return (await res.json()) as FeaturedItem[]
		} catch {
			return []
		}
	})()
	const recommendedPromise = (async (): Promise<TMDBMediaResult[]> => {
		try {
			const res = await fetch('/api/recommendations?limit=24')
			if (!res.ok) return []
			return (await res.json()) as TMDBMediaResult[]
		} catch {
			return []
		}
	})()

	const [trending, featured, recommended] = await Promise.all([
		trendingPromise,
		featuredPromise,
		recommendedPromise
	])
	return { trending, featured, recommended }
}
