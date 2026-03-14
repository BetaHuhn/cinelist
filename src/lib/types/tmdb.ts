export type TMDBMediaType = 'movie' | 'tv'

export type TMDBMultiMediaType = TMDBMediaType | 'person'

export interface TMDBMovie {
	id: number
	title: string
	overview: string
	poster_path: string | null
	backdrop_path: string | null
	release_date: string
	media_type?: 'movie'
	vote_average: number
	vote_count: number
	genre_ids: number[]
	genres?: TMDBGenre[]
	runtime?: number | null
	imdb_id?: string | null
	tagline?: string | null
	status?: string
	original_language?: string
	popularity?: number
}

export interface TMDBTV {
	id: number
	name: string
	overview: string
	poster_path: string | null
	backdrop_path: string | null
	first_air_date: string
	media_type?: 'tv'
	vote_average: number
	vote_count: number
	genre_ids: number[]
	genres?: TMDBGenre[]
	episode_run_time?: number[]
	seasons?: TMDBSeason[]
	tagline?: string | null
	status?: string
	original_language?: string
	popularity?: number
}

export interface TMDBSeason {
	id: number
	name: string
	overview: string
	poster_path: string | null
	season_number: number
	episode_count: number
	air_date: string | null
}

export type TMDBMedia = TMDBMovie | TMDBTV

// Results from `/search/multi` and `/trending/all/*` always include a `media_type`.
export type TMDBMediaResult =
	| (TMDBMovie & { media_type: 'movie' })
	| (TMDBTV & { media_type: 'tv' })

export interface TMDBPerson {
	id: number
	name: string
	profile_path: string | null
	known_for_department?: string
	popularity?: number
	media_type?: 'person'
}

export type TMDBPersonResult = TMDBPerson & { media_type: 'person' }

export interface TMDBGenre {
	id: number
	name: string
}

export interface TMDBKeyword {
	id: number
	name: string
}

export interface TMDBCastMember {
	id: number
	name: string
	character: string
	profile_path: string | null
	order: number
}

export interface TMDBCrewMember {
	id: number
	name: string
	job: string
	department: string
	profile_path: string | null
}

export interface TMDBCredits {
	cast: TMDBCastMember[]
	crew: TMDBCrewMember[]
}

export interface TMDBVideo {
	id: string
	key: string
	name: string
	site: string
	type: string
	official: boolean
}

export interface TMDBVideosResponse {
	results: TMDBVideo[]
}

export interface TMDBPagedResponse<T> {
	page: number
	results: T[]
	total_results: number
	total_pages: number
}

export interface TMDBSearchResponse {
	results: TMDBMovie[]
	total_results: number
	total_pages: number
	page: number
}

export interface TMDBMultiSearchResponse {
	results: Array<TMDBMediaResult | TMDBPersonResult>
	total_results: number
	total_pages: number
	page: number
}

export interface TMDBPersonSearchResponse {
	results: TMDBPerson[]
	total_results: number
	total_pages: number
	page: number
}

export interface TMDBPersonDetailResponse extends TMDBPerson {
	biography?: string
	birthday?: string | null
	deathday?: string | null
	place_of_birth?: string | null
	also_known_as?: string[]
	gender?: number
}

export type TMDBPersonCombinedCredit = (TMDBMovieResult | TMDBTVResult) & {
	character?: string
	job?: string
	department?: string
}

export type TMDBMovieResult = TMDBMovie & { media_type: 'movie' }
export type TMDBTVResult = TMDBTV & { media_type: 'tv' }

export interface TMDBPersonCombinedCreditsResponse {
	id: number
	cast: TMDBPersonCombinedCredit[]
	crew: TMDBPersonCombinedCredit[]
}

export interface TMDBReleaseDatesResult {
	iso_3166_1: string
	release_dates: {
		certification: string
		release_date: string
		type: number
	}[]
}

export interface TMDBReleaseDatesResponse {
	results: TMDBReleaseDatesResult[]
}

export interface TMDBMovieDetailResponse extends TMDBMovie {
	credits: TMDBCredits
	videos: TMDBVideosResponse
	release_dates: TMDBReleaseDatesResponse
}

export interface TMDBContentRatingResult {
	iso_3166_1: string
	rating: string
}

export interface TMDBContentRatingsResponse {
	results: TMDBContentRatingResult[]
}

export interface TMDBTVDetailResponse extends TMDBTV {
	credits: TMDBCredits
	videos: TMDBVideosResponse
	content_ratings: TMDBContentRatingsResponse
}

export interface TMDBPersonExternalIdsResponse {
	imdb_id: string | null
}

// Keywords
// Movie keywords endpoint returns `{ id, keywords: [...] }`.
export interface TMDBMovieKeywordsResponse {
	id: number
	keywords: TMDBKeyword[]
}

// TV keywords endpoint returns `{ id, results: [...] }`.
export interface TMDBTVKeywordsResponse {
	id: number
	results: TMDBKeyword[]
}
