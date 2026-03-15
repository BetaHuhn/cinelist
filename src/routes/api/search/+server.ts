import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { searchMulti, searchPeople } from '$lib/api/tmdb'

export const GET: RequestHandler = async ({ url, fetch }) => {
	const q = url.searchParams.get('q')?.trim() ?? ''
	if (!q) return json({ media: [], people: [] })

	const [media, people] = await Promise.all([
		searchMulti(q, { fetchFn: fetch }),
		searchPeople(q, { fetchFn: fetch })
	])

	return json({ media, people })
}
