import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getHomeRecommendationsCache } from '$lib/kv/recommendations'
import { getWatchlist } from '$lib/kv/watchlist'
import type { TMDBMediaResult } from '$lib/types/tmdb'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 60

function parseLimit(url: URL): number {
	const raw = url.searchParams.get('limit')
	if (!raw) return DEFAULT_LIMIT
	const n = Number(raw)
	if (!Number.isFinite(n)) return DEFAULT_LIMIT
	return Math.max(1, Math.min(MAX_LIMIT, Math.floor(n)))
}

function parseExcluded(url: URL): Set<string> {
	const raw = url.searchParams.get('excluded')
	if (!raw) return new Set()
	return new Set(
		raw
			.split(',')
			.map(s => s.trim())
			.filter(s => /^(movie|tv):\d+$/.test(s))
	)
}

async function fetchRecommendations(fetch: typeof globalThis.fetch, fresh = false): Promise<TMDBMediaResult[]> {
	const params = new URLSearchParams({ limit: String(MAX_LIMIT) })
	if (fresh) params.set('fresh', '1')
	const res = await fetch(`/api/recommendations?${params}`)
	if (!res.ok) return []
	return (await res.json()) as TMDBMediaResult[]
}

/**
 * Interleave movies and TV shows 3:1 so the deck is movie-heavy.
 * Preserves the relative ordering within each type (score order from recs).
 */
function applyMovieBias(items: TMDBMediaResult[], limit: number): TMDBMediaResult[] {
	const movies = items.filter(i => i.media_type === 'movie')
	const tv = items.filter(i => i.media_type === 'tv')
	const result: TMDBMediaResult[] = []
	let mi = 0, ti = 0
	while (result.length < limit && (mi < movies.length || ti < tv.length)) {
		// 3 movies then 1 TV
		for (let k = 0; k < 3 && mi < movies.length && result.length < limit; k++) {
			result.push(movies[mi++])
		}
		if (ti < tv.length && result.length < limit) {
			result.push(tv[ti++])
		}
	}
	return result
}

export const GET: RequestHandler = async ({ url, fetch }) => {
	const limit = parseLimit(url)
	const excluded = parseExcluded(url)

	// Filter out already-watchlisted items (server-side).
	const watchlist = await getWatchlist()
	const inWatchlist = new Set(watchlist.map(i => `${i.mediaType}:${i.id}`))

	function applyFilters(candidates: TMDBMediaResult[]): TMDBMediaResult[] {
		return candidates.filter(item => {
			const key = `${item.media_type}:${item.id}`
			return !inWatchlist.has(key) && !excluded.has(key)
		})
	}

	// Try the recommendations cache first.
	let candidates: TMDBMediaResult[] = []
	const cached = await getHomeRecommendationsCache()
	if (cached && cached.items.length > 0) {
		candidates = cached.items
	} else {
		candidates = await fetchRecommendations(fetch)
	}

	let results = applyMovieBias(applyFilters(candidates), limit)

	// If the cached pool is exhausted (all items excluded), do a fresh TMDB fetch
	// so the user gets new suggestions without waiting for the 6-hour cache to expire.
	if (results.length === 0 && excluded.size > 0) {
		const fresh = await fetchRecommendations(fetch, true)
		results = applyMovieBias(applyFilters(fresh), limit)
	}

	return json(results)
}
