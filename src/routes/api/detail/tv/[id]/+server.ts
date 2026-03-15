import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { fetchTVDetail } from '$lib/api/tmdb'
import { buildTVDetail } from '$lib/utils/format'

export const GET: RequestHandler = async ({ params, fetch }) => {
	const id = parseInt(params.id, 10)
	if (isNaN(id)) error(400, 'Invalid TV series ID')

	const detail = await fetchTVDetail(id, fetch)
	return json(buildTVDetail(detail))
}
