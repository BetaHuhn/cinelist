import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { fetchTVDetail, fetchTVRecommendations } from '$lib/api/tmdb'
import { buildTVDetail } from '$lib/utils/format'

export const GET: RequestHandler = async ({ params, fetch }) => {
	const id = parseInt(params.id, 10)
	if (isNaN(id)) error(400, 'Invalid TV series ID')

	const [detail, related] = await Promise.all([
		fetchTVDetail(id, fetch),
		fetchTVRecommendations(id, fetch).catch(() => [])
	])
	const tv = buildTVDetail(detail)
	return json({ tv, related })
}
