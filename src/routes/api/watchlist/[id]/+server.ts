import { json, error } from '@sveltejs/kit'
import { removeItem, toggleMediaServer, toggleWatched, setRating } from '$lib/kv/watchlist'
import { clearHomeRecommendationsCache } from '$lib/kv/recommendations'
import type { RequestHandler } from './$types'

function getMediaType(url: URL): 'movie' | 'tv' {
	const raw = url.searchParams.get('type') ?? url.searchParams.get('mediaType')
	return raw === 'tv' ? 'tv' : 'movie'
}

export const DELETE: RequestHandler = async ({ params, url }) => {
	const id = parseInt(params.id, 10)
	if (isNaN(id)) error(400, 'Invalid id')
	const mediaType = getMediaType(url)
	await removeItem(mediaType, id)
	await clearHomeRecommendationsCache()
	return new Response(null, { status: 204 })
}

export const PATCH: RequestHandler = async ({ params, url }) => {
	const id = parseInt(params.id, 10)
	if (isNaN(id)) error(400, 'Invalid id')
	const mediaType = getMediaType(url)
	const toggle = (url.searchParams.get('toggle') ?? '').toLowerCase()

	let updated
	if (toggle === 'watched') {
		updated = await toggleWatched(mediaType, id)
	} else if (toggle === 'rating') {
		const ratingRaw = url.searchParams.get('rating')
		if (ratingRaw === null || ratingRaw === '') {
			updated = await setRating(mediaType, id, null)
		} else {
			const rating = Number(ratingRaw)
			if (!Number.isFinite(rating) || rating < 0 || rating > 10) {
				error(400, 'Rating must be a number between 0 and 10')
			}
			updated = await setRating(mediaType, id, rating)
		}
	} else {
		updated = await toggleMediaServer(mediaType, id)
	}

	if (!updated) error(404, 'Item not found')
	await clearHomeRecommendationsCache()
	return json(updated)
}
