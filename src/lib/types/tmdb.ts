export type TMDBMediaType = 'movie' | 'tv'

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

export interface TMDBGenre {
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
	results: Array<TMDBMediaResult | { media_type: 'person' }>
	total_results: number
	total_pages: number
	page: number
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
