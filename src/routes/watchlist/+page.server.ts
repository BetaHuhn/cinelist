import { getWatchlist } from '$lib/kv/watchlist'
import { getFavoritePeople } from '$lib/kv/people'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
	const [items, people] = await Promise.all([getWatchlist(), getFavoritePeople()])
	return { items, people }
}
