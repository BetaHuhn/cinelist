import { env } from '$env/dynamic/public'
import type {
	TMDBMovieDetailResponse,
	TMDBTVDetailResponse,
	TMDBSearchResponse,
	TMDBMultiSearchResponse,
	TMDBMovie,
	TMDBMediaResult,
	TMDBPagedResponse,
	TMDBTV,
	TMDBPersonExternalIdsResponse
} from '$lib/types/tmdb'

const BASE = 'https://api.themoviedb.org/3'

function getApiKey(): string {
	const key = env.PUBLIC_TMDB_API_KEY
	if (!key) throw new Error('PUBLIC_TMDB_API_KEY is not set')
	return key
}

async function tmdbFetch<T>(
	path: string,
	params: Record<string, string> = {},
	fetchFn: typeof fetch = fetch
): Promise<T> {
	const url = new URL(`${BASE}${path}`)
	url.searchParams.set('api_key', getApiKey())
	for (const [k, v] of Object.entries(params)) {
		url.searchParams.set(k, v)
	}
	const res = await fetchFn(url.toString(), {
		headers: {
			'Authorization': `Bearer ${getApiKey()}`,
		}
	})
	if (!res.ok) throw new Error(`TMDB ${path} failed: ${res.status}`)
	return res.json() as Promise<T>
}

export async function searchMovies(
	query: string,
	opts?: typeof fetch | { year?: number; fetchFn?: typeof fetch }
): Promise<TMDBMovie[]> {
	if (!query.trim()) return []
	const fetchFn = typeof opts === 'function' ? opts : opts?.fetchFn
	const year = typeof opts === 'function' ? undefined : opts?.year
	const data = await tmdbFetch<TMDBSearchResponse>(
		'/search/movie',
		{
			query: query.trim(),
			include_adult: 'false',
			...(year ? { year: String(year) } : {})
		},
		fetchFn
	)
	return data.results
}

export async function searchMulti(
	query: string,
	opts?: typeof fetch | { fetchFn?: typeof fetch }
): Promise<TMDBMediaResult[]> {
	if (!query.trim()) return []
	const fetchFn = typeof opts === 'function' ? opts : opts?.fetchFn
	const data = await tmdbFetch<TMDBMultiSearchResponse>(
		'/search/multi',
		{ query: query.trim(), include_adult: 'false' },
		fetchFn
	)
	return data.results.filter(
		(r): r is TMDBMediaResult => r.media_type === 'movie' || r.media_type === 'tv'
	)
}

export async function fetchTrending(fetchFn?: typeof fetch): Promise<TMDBMediaResult[]> {
	const data = await tmdbFetch<TMDBMultiSearchResponse>('/trending/all/week', {}, fetchFn)
	return data.results.filter(
		(r): r is TMDBMediaResult => r.media_type === 'movie' || r.media_type === 'tv'
	)
}

export function fetchMovieDetail(
	id: number,
	fetchFn?: typeof fetch
): Promise<TMDBMovieDetailResponse> {
	return tmdbFetch<TMDBMovieDetailResponse>(
		`/movie/${id}`,
		{ append_to_response: 'credits,videos,release_dates' },
		fetchFn
	)
}

export function fetchTVDetail(id: number, fetchFn?: typeof fetch): Promise<TMDBTVDetailResponse> {
	return tmdbFetch<TMDBTVDetailResponse>(
		`/tv/${id}`,
		{ append_to_response: 'credits,videos,content_ratings' },
		fetchFn
	)
}

export async function fetchMovieRecommendations(
	id: number,
	fetchFn?: typeof fetch
): Promise<TMDBMovie[]> {
	const data = await tmdbFetch<TMDBPagedResponse<TMDBMovie>>(`/movie/${id}/recommendations`, {}, fetchFn)
	return data.results
}

export async function fetchTVRecommendations(
	id: number,
	fetchFn?: typeof fetch
): Promise<TMDBTV[]> {
	const data = await tmdbFetch<TMDBPagedResponse<TMDBTV>>(`/tv/${id}/recommendations`, {}, fetchFn)
	return data.results
}

export function fetchPersonExternalIds(
	id: number,
	fetchFn?: typeof fetch
): Promise<TMDBPersonExternalIdsResponse> {
	return tmdbFetch<TMDBPersonExternalIdsResponse>(`/person/${id}/external_ids`, {}, fetchFn)
}
