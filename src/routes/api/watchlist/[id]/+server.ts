import { json, error } from '@sveltejs/kit'
import { removeItem, toggleMediaServer, toggleWatched } from '$lib/kv/watchlist'
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
	const updated = toggle === 'watched'
		? await toggleWatched(mediaType, id)
		: await toggleMediaServer(mediaType, id)
	if (!updated) error(404, 'Item not found')
	await clearHomeRecommendationsCache()
	return json(updated)
}
