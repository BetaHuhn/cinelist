import { getWatchlist } from '$lib/kv/watchlist'
import { buildMoodRecommendations, isMoodKey, moodOptions } from '$lib/server/moodRecommendations'
import type { TMDBMediaResult } from '$lib/types/tmdb'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ fetch, url }) => {
	const moodParam = url.searchParams.get('s')
	const mood = isMoodKey(moodParam) ? moodParam : null

	if (!mood) {
		return {
			mood,
			recommendations: [],
			moodOptions
		}
	}

	const [watchlist, fallbackResponse] = await Promise.all([
		getWatchlist(),
		fetch('/api/recommendations?limit=24').catch(() => null)
	])

	let fallback: TMDBMediaResult[] = []
	if (fallbackResponse?.ok) {
		try {
			fallback = (await fallbackResponse.json()) as TMDBMediaResult[]
		} catch {
			fallback = []
		}
	}

	const recommendations = buildMoodRecommendations(watchlist, mood, fallback)

	return {
		mood,
		recommendations,
		moodOptions
	}
}
