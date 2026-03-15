import { env } from '$env/dynamic/private'
import type { OMDBResponse } from '$lib/types/omdb'

const BASE = 'https://www.omdbapi.com'

function getApiKey(): string {
	return env.OMDB_API_KEY ?? ''
}

export async function fetchOMDBByImdbId(
	imdbId: string,
	fetchFn: typeof fetch = fetch
): Promise<OMDBResponse | null> {
	const key = getApiKey()
	if (!key || !imdbId) return null
	const url = `${BASE}/?apikey=${key}&i=${imdbId}&tomatoes=true`
	try {
		const res = await fetchFn(url)
		if (!res.ok) return null
		const data = (await res.json()) as OMDBResponse
		return data.Response === 'True' ? data : null
	} catch {
		return null
	}
}
