import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { fetchMovieDetail } from '$lib/api/tmdb'
import { fetchOMDBByImdbId } from '$lib/api/omdb'
import { buildMovieDetail } from '$lib/utils/format'

export const GET: RequestHandler = async ({ params, fetch }) => {
	const id = parseInt(params.id, 10)
	if (isNaN(id)) error(400, 'Invalid movie ID')

	const detail = await fetchMovieDetail(id, fetch)
	const omdb = detail.imdb_id
		? await fetchOMDBByImdbId(detail.imdb_id, fetch).catch(() => null)
		: null

	return json(buildMovieDetail(detail, omdb))
}
