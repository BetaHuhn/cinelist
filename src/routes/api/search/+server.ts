import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { searchMulti, searchPeople } from '$lib/api/tmdb'

export const GET: RequestHandler = async ({ url, fetch }) => {
	const q = (url.searchParams.get('q') ?? '').trim()
	if (!q) return json({ results: [], people: [] })

	const [results, people] = await Promise.all([
		searchMulti(q, { fetchFn: fetch }).catch(() => []),
		searchPeople(q, { fetchFn: fetch }).catch(() => [])
	])

	return json({ results, people })
}
