import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { removeBlacklistItem } from '$lib/kv/blacklist'

export const DELETE: RequestHandler = async ({ params, url }) => {
	const id = parseInt(params.id, 10)
	if (isNaN(id) || id <= 0) error(400, 'Invalid id')
	const raw = url.searchParams.get('type') ?? url.searchParams.get('mediaType')
	const mediaType = raw === 'tv' ? 'tv' : 'movie'
	await removeBlacklistItem(mediaType, id)
	return new Response(null, { status: 204 })
}
