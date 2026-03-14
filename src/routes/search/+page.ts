import { searchMulti } from '$lib/api/tmdb'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ url, fetch }) => {
	const q = url.searchParams.get('q')?.trim() ?? ''
	if (!q) return { q, results: [] }

	try {
		const results = await searchMulti(q, fetch)
		return { q, results }
	} catch {
		return { q, results: [], failed: true }
	}
}
