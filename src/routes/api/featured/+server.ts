import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getWatchlist } from '$lib/kv/watchlist'
import { getFeaturedFromWatchlist } from '$lib/server/featured'

function parseLimit(url: URL): number {
	const raw = url.searchParams.get('limit')
	if (!raw) return 8
	const n = Number(raw)
	if (!Number.isFinite(n)) return 8
	return Math.max(1, Math.min(12, Math.floor(n)))
}

export const GET: RequestHandler = async ({ url, fetch }) => {
	const limit = parseLimit(url)
	const items = await getWatchlist()
	const featured = await getFeaturedFromWatchlist(items, fetch, limit)
	return json(featured)
}
