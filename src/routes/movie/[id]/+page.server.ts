import { fetchMovieDetail, fetchMovieRecommendations, fetchMovieCredits } from '$lib/api/tmdb'
import { fetchOMDBByImdbId } from '$lib/api/omdb'
import { buildMovieDetail } from '$lib/utils/format'
import { getFavoritePeopleMap } from '$lib/kv/people'
import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import type { FavoritePeopleByMedia } from '$lib/types/app'

export const load: PageServerLoad = async ({ params, fetch }) => {
	const id = parseInt(params.id, 10)
	if (isNaN(id)) error(400, 'Invalid movie ID')

	const [detail, related, favPeopleMap] = await Promise.all([
		fetchMovieDetail(id, fetch),
		fetchMovieRecommendations(id, fetch).catch(() => []),
		getFavoritePeopleMap().catch(() => new Map<number, string>())
	])

	// Fetch OMDB data and credits for each related item in parallel.
	// Using per-media credits (O(related) calls) is more efficient than
	// per-person combined_credits (O(favorites) calls) when favorites grow large.
	const omdbPromise = detail.imdb_id
		? fetchOMDBByImdbId(detail.imdb_id, fetch).catch(() => null)
		: Promise.resolve(null)
	const relatedCreditsPromise = favPeopleMap.size > 0
		? Promise.all(related.map(m => fetchMovieCredits(m.id, fetch).catch(() => ({ cast: [], crew: [] }))))
		: Promise.resolve([])

	const [omdb, relatedCredits] = await Promise.all([omdbPromise, relatedCreditsPromise])

	// Build favoritePeopleByMedia keyed by "movie:{id}" for the related section
	const favoritePeopleByMedia: FavoritePeopleByMedia = {}
	for (let i = 0; i < related.length; i++) {
		const key = `movie:${related[i].id}`
		for (const member of [...(relatedCredits[i]?.cast ?? []), ...(relatedCredits[i]?.crew ?? [])]) {
			const name = favPeopleMap.get(member.id)
			if (name) {
				if (!favoritePeopleByMedia[key]) favoritePeopleByMedia[key] = []
				if (!favoritePeopleByMedia[key].some(p => p.id === member.id)) {
					favoritePeopleByMedia[key].push({ id: member.id, name })
				}
			}
		}
	}

	const movie = buildMovieDetail(detail, omdb)
	return { movie, related, favoritePeopleByMedia }
}
