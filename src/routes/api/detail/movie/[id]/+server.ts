import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { fetchMovieDetail, fetchMovieRecommendations } from '$lib/api/tmdb'
import { fetchOMDBByImdbId } from '$lib/api/omdb'
import { buildMovieDetail } from '$lib/utils/format'

export const GET: RequestHandler = async ({ params, fetch }) => {
	const id = parseInt(params.id, 10)
	if (isNaN(id)) error(400, 'Invalid movie ID')

	const [detail, related] = await Promise.all([
		fetchMovieDetail(id, fetch),
		fetchMovieRecommendations(id, fetch).catch(() => [])
	])
	const omdb = detail.imdb_id
		? await fetchOMDBByImdbId(detail.imdb_id, fetch).catch(() => null)
		: null

	const movie = buildMovieDetail(detail, omdb)
	return json({ movie, related })
}
