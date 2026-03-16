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

export const GET: RequestHandler = async ({ url, fetch }) => {
	const limit = parseLimit(url)
	const excluded = parseExcluded(url)

	// Try to get cached recommendations first; fall back to a fresh fetch.
	let candidates: TMDBMediaResult[] = []

	const cached = await getHomeRecommendationsCache()
	if (cached && cached.items.length > 0) {
		candidates = cached.items
	} else {
		// No cache yet – fetch recommendations and pass through.
		const res = await fetch(`/api/recommendations?limit=${MAX_LIMIT}`)
		if (res.ok) {
			candidates = (await res.json()) as TMDBMediaResult[]
		}
	}

	// Filter out already-watched / watchlisted items.
	const watchlist = await getWatchlist()
	const inWatchlist = new Set(watchlist.map(i => `${i.mediaType}:${i.id}`))

	const results = candidates
		.filter(item => {
			const key = `${item.media_type}:${item.id}`
			return !inWatchlist.has(key) && !excluded.has(key)
		})
		.slice(0, limit)

	return json(results)
}
