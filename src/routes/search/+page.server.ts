import { searchMulti, searchPeople } from '$lib/api/tmdb'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ url, fetch }) => {
	const q = url.searchParams.get('q')?.trim() ?? ''
	if (!q) return { q, results: [], people: [] }

	try {
		const [results, people] = await Promise.all([
			searchMulti(q, { fetchFn: fetch }),
			searchPeople(q, { fetchFn: fetch })
		])
		return { q, results, people }
	} catch {
		return { q, results: [], people: [], failed: true }
	}
}
