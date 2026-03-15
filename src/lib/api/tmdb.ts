import { env } from '$env/dynamic/private'
import type {
	TMDBMovieDetailResponse,
	TMDBTVDetailResponse,
	TMDBSearchResponse,
	TMDBMultiSearchResponse,
	TMDBPersonSearchResponse,
	TMDBMovie,
	TMDBMediaResult,
	TMDBPagedResponse,
	TMDBTV,
	TMDBPerson,
	TMDBPersonDetailResponse,
	TMDBPersonCombinedCreditsResponse,
	TMDBPersonExternalIdsResponse,
	TMDBMovieKeywordsResponse,
	TMDBTVKeywordsResponse,
	TMDBKeyword,
	TMDBSeasonDetailResponse
} from '$lib/types/tmdb'

const BASE = 'https://api.themoviedb.org/3'

function getApiKey(): string {
	const key = env.TMDB_API_KEY
	if (!key) throw new Error('TMDB_API_KEY is not set')
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

export async function searchPeople(
	query: string,
	opts?: typeof fetch | { fetchFn?: typeof fetch }
): Promise<TMDBPerson[]> {
	if (!query.trim()) return []
	const fetchFn = typeof opts === 'function' ? opts : opts?.fetchFn
	const data = await tmdbFetch<TMDBPersonSearchResponse>(
		'/search/person',
		{ query: query.trim(), include_adult: 'false' },
		fetchFn
	)
	return Array.isArray(data.results) ? data.results : []
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

export function fetchTVSeasonDetail(
	tvId: number,
	seasonNumber: number,
	fetchFn?: typeof fetch
): Promise<TMDBSeasonDetailResponse> {
	return tmdbFetch<TMDBSeasonDetailResponse>(
		`/tv/${tvId}/season/${seasonNumber}`,
		{},
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

export async function fetchMovieKeywords(id: number, fetchFn?: typeof fetch): Promise<TMDBKeyword[]> {
	const data = await tmdbFetch<TMDBMovieKeywordsResponse>(`/movie/${id}/keywords`, {}, fetchFn)
	return Array.isArray(data.keywords) ? data.keywords : []
}

export async function fetchTVKeywords(id: number, fetchFn?: typeof fetch): Promise<TMDBKeyword[]> {
	const data = await tmdbFetch<TMDBTVKeywordsResponse>(`/tv/${id}/keywords`, {}, fetchFn)
	return Array.isArray(data.results) ? data.results : []
}

export type TMDBSortBy =
	| 'popularity.desc'
	| 'popularity.asc'
	| 'vote_average.desc'
	| 'vote_average.asc'
	| 'vote_count.desc'
	| 'vote_count.asc'
	| 'primary_release_date.desc'
	| 'primary_release_date.asc'
	| 'first_air_date.desc'
	| 'first_air_date.asc'

export interface TMDBDiscoverParams {
	with_genres?: string
	with_keywords?: string
	with_people?: string
	sort_by?: TMDBSortBy
	page?: number
	include_adult?: boolean
	'vote_count.gte'?: number
	'vote_average.gte'?: number
}

function toDiscoverQuery(params: TMDBDiscoverParams): Record<string, string> {
	const query: Record<string, string> = {
		include_adult: String(params.include_adult ?? false)
	}
	if (params.with_genres) query.with_genres = params.with_genres
	if (params.with_keywords) query.with_keywords = params.with_keywords
	if (params.with_people) query.with_people = params.with_people
	if (params.sort_by) query.sort_by = params.sort_by
	if (params.page) query.page = String(params.page)
	if (params['vote_count.gte'] != null) query['vote_count.gte'] = String(params['vote_count.gte'])
	if (params['vote_average.gte'] != null) query['vote_average.gte'] = String(params['vote_average.gte'])
	return query
}

export async function discoverMovies(
	params: TMDBDiscoverParams,
	fetchFn?: typeof fetch
): Promise<TMDBMovie[]> {
	const data = await tmdbFetch<TMDBPagedResponse<TMDBMovie>>(
		'/discover/movie',
		toDiscoverQuery(params),
		fetchFn
	)
	return data.results
}

export async function discoverTV(
	params: TMDBDiscoverParams,
	fetchFn?: typeof fetch
): Promise<TMDBTV[]> {
	const data = await tmdbFetch<TMDBPagedResponse<TMDBTV>>(
		'/discover/tv',
		toDiscoverQuery(params),
		fetchFn
	)
	return data.results
}

export function fetchPersonExternalIds(
	id: number,
	fetchFn?: typeof fetch
): Promise<TMDBPersonExternalIdsResponse> {
	return tmdbFetch<TMDBPersonExternalIdsResponse>(`/person/${id}/external_ids`, {}, fetchFn)
}

export function fetchPersonDetail(id: number, fetchFn?: typeof fetch): Promise<TMDBPersonDetailResponse> {
	return tmdbFetch<TMDBPersonDetailResponse>(`/person/${id}`, {}, fetchFn)
}

export function fetchPersonCombinedCredits(
	id: number,
	fetchFn?: typeof fetch
): Promise<TMDBPersonCombinedCreditsResponse> {
	return tmdbFetch<TMDBPersonCombinedCreditsResponse>(`/person/${id}/combined_credits`, {}, fetchFn)
}
