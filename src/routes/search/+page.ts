import { searchMulti, searchPeople } from '$lib/api/tmdb'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ url, fetch }) => {
	const q = url.searchParams.get('q')?.trim() ?? ''
	if (!q) return { q, results: [], people: [] }

	try {
		const [results, people] = await Promise.all([
			searchMulti(q, fetch),
			searchPeople(q, fetch)
		])
		return { q, results, people }
	} catch {
		return { q, results: [], people: [], failed: true }
	}
}
