import { fetchTVSeasonDetail, fetchTVDetail } from '$lib/api/tmdb'
import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, fetch }) => {
	const tvId = parseInt(params.id, 10)
	const seasonNumber = parseInt(params.seasonNumber, 10)
	if (isNaN(tvId)) error(400, 'Invalid TV series ID')
	if (isNaN(seasonNumber)) error(400, 'Invalid season number')

	const [season, tvDetail] = await Promise.all([
		fetchTVSeasonDetail(tvId, seasonNumber, fetch),
		fetchTVDetail(tvId, fetch)
	])
	return { season, tvId, tvName: tvDetail.name }
}
