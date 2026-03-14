import { fetchTrending } from '$lib/api/tmdb'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ fetch }) => {
	const trending = await fetchTrending(fetch)
	return { trending }
}
