import { getWatchlist } from '$lib/kv/watchlist'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
	const items = await getWatchlist()
	return { items }
}
