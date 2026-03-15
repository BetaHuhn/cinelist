export type FeaturedStatus = 'ready' | 'pending'

export interface FeaturedItem {
	mediaType: 'movie' | 'tv'
	id: number
	title: string
	poster_path: string | null
	backdrop_path: string | null
	release_date: string
	vote_average: number
	overview: string
	byline: string | null
	status: FeaturedStatus
}
