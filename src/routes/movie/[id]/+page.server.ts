import { fetchMovieDetail, fetchMovieRecommendations, fetchMovieCredits, fetchMovieKeywords, discoverMovies } from '$lib/api/tmdb'
import { fetchOMDBByImdbId } from '$lib/api/omdb'
import { buildMovieDetail } from '$lib/utils/format'
import { getFavoritePeopleMap } from '$lib/kv/people'
import { getWatchlist } from '$lib/kv/watchlist'
import { topGenreSet, rankRelated } from '$lib/utils/related'
import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import type { FavoritePeopleByMedia } from '$lib/types/app'

// Keep enough candidates so the client-side blacklist filter still leaves plenty to display.
const RELATED_FETCH_LIMIT = 20

export const load: PageServerLoad = async ({ params, fetch }) => {
	const id = parseInt(params.id, 10)
	if (isNaN(id)) error(400, 'Invalid movie ID')

	// Fetch item detail, TMDB recommendations, user data, and item keywords in parallel.
	const [detail, tmdbRecs, favPeopleMap, watchlist, keywords] = await Promise.all([
		fetchMovieDetail(id, fetch),
		fetchMovieRecommendations(id, fetch).catch(() => []),
		getFavoritePeopleMap().catch(() => new Map<number, string>()),
		getWatchlist().catch(() => []),
		fetchMovieKeywords(id, fetch).catch(() => [])
	])

	// Derive user genre preferences from their movie watchlist (most-recent-first order).
	const movieWatchlistItems = watchlist.filter(i => i.mediaType === 'movie')
	const userGenrePref = topGenreSet(movieWatchlistItems, 5)

	// Keyword-based discovery: use the item's top keyword (+ user's genre preferences) to
	// surface additional related titles beyond what TMDB's recommendation endpoint returns.
	const topKeywordId = keywords[0]?.id
	const keywordDiscover = topKeywordId
		? await discoverMovies(
				{
					with_keywords: String(topKeywordId),
					with_genres: userGenrePref.size > 0
						// Pipe-separated = OR: return items in any of the user's top genres.
						// Using OR keeps the pool wide enough to be useful across diverse tastes.
						? Array.from(userGenrePref).slice(0, 3).join('|')
						: undefined,
					sort_by: 'vote_average.desc',
					page: 1,
					include_adult: false,
					'vote_count.gte': 25
				},
				fetch
			).catch(() => [])
		: []

	// Re-rank the combined pool by user preference signals; cap at fetch limit.
	const related = rankRelated(tmdbRecs, keywordDiscover, userGenrePref, id).slice(0, RELATED_FETCH_LIMIT)

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
