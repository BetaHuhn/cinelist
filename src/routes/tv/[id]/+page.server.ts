import { fetchTVDetail, fetchTVRecommendations, fetchTVCredits } from '$lib/api/tmdb'
import { buildTVDetail } from '$lib/utils/format'
import { getFavoritePeopleMap } from '$lib/kv/people'
import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import type { FavoritePeopleByMedia } from '$lib/types/app'

export const load: PageServerLoad = async ({ params, fetch }) => {
	const id = parseInt(params.id, 10)
	if (isNaN(id)) error(400, 'Invalid TV series ID')

	const [detail, related, favPeopleMap] = await Promise.all([
		fetchTVDetail(id, fetch),
		fetchTVRecommendations(id, fetch).catch(() => []),
		getFavoritePeopleMap().catch(() => new Map<number, string>())
	])

	// Fetch credits for each related item in parallel.
	// Using per-media credits (O(related) calls) is more efficient than
	// per-person combined_credits (O(favorites) calls) when favorites grow large.
	const relatedCredits = favPeopleMap.size > 0
		? await Promise.all(related.map(m => fetchTVCredits(m.id, fetch).catch(() => ({ cast: [], crew: [] }))))
		: []

	// Build favoritePeopleByMedia keyed by "tv:{id}" for the related section
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
	return { tv, related, favoritePeopleByMedia }
}
