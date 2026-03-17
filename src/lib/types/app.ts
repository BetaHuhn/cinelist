import type { TMDBCastMember, TMDBCrewMember, TMDBMovie, TMDBTVDetailResponse, TMDBVideo } from './tmdb'

export type MediaType = 'movie' | 'tv'

export interface WatchlistItem {
	mediaType: MediaType
	id: number
	title: string
	poster_path: string | null
	backdrop_path: string | null
	release_date: string
	vote_average: number
	genre_ids: number[]
	addedAt: number
	onMediaServer: boolean
	watched: boolean
	userRating: number | null
	jellyfinItemId?: string
}

export interface FavoritePerson {
	id: number
	name: string
	profile_path: string | null
	known_for_department: string | null
	addedAt: number
}

export type WatchlistStatus = 'ready' | 'pending' | 'watched' | 'all'

export interface AppRatings {
	tmdb: number | null
	rottenTomatoes: string | null
	metacritic: string | null
}

export interface MovieDetail extends TMDBMovie {
	credits: {
		cast: TMDBCastMember[]
		crew: TMDBCrewMember[]
	}
	ratings: AppRatings
	certification: string | null
	trailer: TMDBVideo | null
}

export interface TVDetail extends TMDBTVDetailResponse {
	credits: {
		cast: TMDBCastMember[]
		crew: TMDBCrewMember[]
	}
	ratings: AppRatings
	certification: string | null
	trailer: TMDBVideo | null
}

export interface BlacklistItem {
	mediaType: MediaType
	id: number
	title: string
	poster_path: string | null
	addedAt: number
}

export interface Toast {
	id: string
	message: string
	type: 'success' | 'error' | 'info'
}

/** Map from "movie:id" or "tv:id" to the subset of favorite people appearing in it. */
export type FavoritePeopleByMedia = Record<string, { id: number; name: string }[]>
