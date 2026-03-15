import { fetchTVDetail, fetchTVRecommendations } from '$lib/api/tmdb'
import { buildTVDetail } from '$lib/utils/format'
import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, fetch }) => {
	const id = parseInt(params.id, 10)
	if (isNaN(id)) error(400, 'Invalid TV series ID')

	const [detail, related] = await Promise.all([
		fetchTVDetail(id, fetch),
		fetchTVRecommendations(id, fetch).catch(() => [])
	])
	const tv = buildTVDetail(detail)
	return { tv, related }
}
