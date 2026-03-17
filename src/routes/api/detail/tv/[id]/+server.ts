import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { fetchTVDetail, fetchTVRecommendations, fetchTVCredits, fetchTVKeywords, discoverTV } from '$lib/api/tmdb'
import { buildTVDetail } from '$lib/utils/format'
import { getWatchlist } from '$lib/kv/watchlist'
import { getFavoritePeopleMap } from '$lib/kv/people'
import { topGenreSet, rankRelated } from '$lib/utils/related'
import type { FavoritePeopleByMedia } from '$lib/types/app'

// Keep enough candidates so the client-side blacklist filter still leaves plenty to display.
const RELATED_FETCH_LIMIT = 20

export const GET: RequestHandler = async ({ params, fetch }) => {
	const id = parseInt(params.id, 10)
	if (isNaN(id)) error(400, 'Invalid TV series ID')

	const [detail, tmdbRecs, favPeopleMap, watchlist, keywords] = await Promise.all([
		fetchTVDetail(id, fetch),
		fetchTVRecommendations(id, fetch).catch(() => []),
		getFavoritePeopleMap().catch(() => new Map<number, string>()),
		getWatchlist().catch(() => []),
		fetchTVKeywords(id, fetch).catch(() => [])
	])

	// Derive user genre preferences from their TV watchlist (most-recent-first order).
	const tvWatchlistItems = watchlist.filter(i => i.mediaType === 'tv')
	const userGenrePref = topGenreSet(tvWatchlistItems, 5)

	// Keyword-based discovery: use the item's top keyword (+ user's genre preferences) to
	// surface additional related titles beyond what TMDB's recommendation endpoint returns.
	const topKeywordId = keywords[0]?.id
	const keywordDiscover = topKeywordId
		? await discoverTV(
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

	const relatedCredits = favPeopleMap.size > 0
		? await Promise.all(related.map(m => fetchTVCredits(m.id, fetch).catch(() => ({ cast: [], crew: [] }))))
		: []

	// Build favoritePeopleByMedia keyed by "tv:{id}" for the related section.
	const favoritePeopleByMedia: FavoritePeopleByMedia = {}
	for (let i = 0; i < related.length; i++) {
		const key = `tv:${related[i].id}`
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

	const tv = buildTVDetail(detail)
	return json({ tv, related, favoritePeopleByMedia })
}
