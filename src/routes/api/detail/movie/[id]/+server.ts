import { json, error } from '@sveltejs/kit'
import { fetchMovieDetail } from '$lib/api/tmdb'
import { fetchOMDBByImdbId } from '$lib/api/omdb'
import { buildMovieDetail } from '$lib/utils/format'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id, 10)
	if (isNaN(id)) error(400, 'Invalid movie ID')

	try {
		const detail = await fetchMovieDetail(id)
		const omdb = detail.imdb_id
			? await fetchOMDBByImdbId(detail.imdb_id).catch(() => null)
			: null
		return json(buildMovieDetail(detail, omdb))
	} catch {
		error(502, 'Failed to load movie details')
	}
}
