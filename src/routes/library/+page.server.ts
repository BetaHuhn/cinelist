import { getWatchlist } from '$lib/kv/watchlist'
import { getFavoritePeople } from '$lib/kv/people'
import { getFeaturedFromWatchlist } from '$lib/server/featured'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ fetch }) => {
	const [items, people] = await Promise.all([getWatchlist(), getFavoritePeople()])
	const featured = await getFeaturedFromWatchlist(items, fetch, 8)

	return { items, people, featured }
}
