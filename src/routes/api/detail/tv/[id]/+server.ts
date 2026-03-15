import { json, error } from '@sveltejs/kit'
import { fetchTVDetail } from '$lib/api/tmdb'
import { buildTVDetail } from '$lib/utils/format'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id, 10)
	if (isNaN(id)) error(400, 'Invalid TV series ID')

	try {
		const detail = await fetchTVDetail(id)
		return json(buildTVDetail(detail))
	} catch {
		error(502, 'Failed to load TV details')
	}
}
