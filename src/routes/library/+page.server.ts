import { getWatchlist } from '$lib/kv/watchlist'
import { getFavoritePeople } from '$lib/kv/people'
import { getFeaturedFromWatchlist } from '$lib/server/featured'
import { getConfigOption } from '$lib/kv/app-config'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ fetch }) => {
	const [items, people, jellyfinUrl] = await Promise.all([
		getWatchlist(),
		getFavoritePeople(),
		getConfigOption('jellyfinUrl')
	])
	const featured = await getFeaturedFromWatchlist(items, fetch, 8)

	return { items, people, featured, jellyfinUrl }
}
