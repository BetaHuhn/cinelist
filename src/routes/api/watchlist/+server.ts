import { json } from '@sveltejs/kit'
import { getWatchlist, addItem } from '$lib/kv/watchlist'
import { clearHomeRecommendationsCache } from '$lib/kv/recommendations'
import type { RequestHandler } from './$types'
import type { WatchlistItem } from '$lib/types/app'

export const GET: RequestHandler = async () => {
	const items = await getWatchlist()
	return json(items)
}

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as Partial<Omit<WatchlistItem, 'addedAt' | 'onMediaServer' | 'watched'>>
	const mediaType = body.mediaType === 'tv' ? 'tv' : 'movie'
	const id = typeof body.id === 'number' ? body.id : Number(body.id)
	if (!Number.isFinite(id)) {
		return json({ message: 'Invalid id' }, { status: 400 })
	}
	if (typeof body.title !== 'string' || !body.title.trim()) {
		return json({ message: 'Missing title' }, { status: 400 })
	}
	const releaseDate = typeof body.release_date === 'string' ? body.release_date : ''
	const voteAverage = typeof body.vote_average === 'number' ? body.vote_average : 0
	const genreIds = Array.isArray(body.genre_ids) ? body.genre_ids.filter(n => typeof n === 'number') : []

	const item = await addItem({
		mediaType,
		id,
		title: body.title.trim(),
		poster_path: body.poster_path ?? null,
		backdrop_path: body.backdrop_path ?? null,
		release_date: releaseDate,
		vote_average: voteAverage,
		genre_ids: genreIds
	})
	await clearHomeRecommendationsCache()
	return json(item, { status: 201 })
}
