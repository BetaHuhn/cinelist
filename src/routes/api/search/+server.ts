import { json } from '@sveltejs/kit'
import { searchMulti, searchPeople } from '$lib/api/tmdb'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() ?? ''
	if (!q) return json({ media: [], people: [] })

	try {
		const [media, people] = await Promise.all([
			searchMulti(q),
			searchPeople(q)
		])
		return json({ media, people })
	} catch {
		return json({ media: [], people: [] })
	}
}
