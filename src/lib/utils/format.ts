import type { TMDBMovieDetailResponse, TMDBTVDetailResponse, TMDBVideo } from '$lib/types/tmdb'
import type { OMDBResponse } from '$lib/types/omdb'
import type { AppRatings, MovieDetail, TVDetail } from '$lib/types/app'

export function formatRuntime(minutes: number | null | undefined): string {
	if (!minutes) return 'Unknown'
	const h = Math.floor(minutes / 60)
	const m = minutes % 60
	if (h === 0) return `${m}m`
	if (m === 0) return `${h}h`
	return `${h}h ${m}m`
}

export function formatDate(dateStr: string | null | undefined): string {
	if (!dateStr) return 'Unknown'
	const date = new Date(dateStr)
	return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function formatYear(dateStr: string | null | undefined): string {
	if (!dateStr) return ''
	return new Date(dateStr).getFullYear().toString()
}

function pickTrailer(videos: TMDBVideo[]): TMDBVideo | null {
	const trailers = videos.filter(v => v.site === 'YouTube' && v.type === 'Trailer')
	return trailers.find(t => t.official) ?? trailers[0] ?? null
}

function extractRatings(omdb: OMDBResponse | null): AppRatings {
	if (!omdb || omdb.Response === 'False') {
		return { tmdb: null, rottenTomatoes: null, metacritic: null }
	}
	const rt = omdb.Ratings.find(r => r.Source === 'Rotten Tomatoes')?.Value ?? null
	const mc = omdb.Metascore && omdb.Metascore !== 'N/A' ? omdb.Metascore : null
	return { tmdb: null, rottenTomatoes: rt, metacritic: mc }
}

function extractCertification(detail: TMDBMovieDetailResponse): string | null {
	const usRelease = detail.release_dates?.results.find(r => r.iso_3166_1 === 'US')
	if (!usRelease) return null
	const rated = usRelease.release_dates.find(r => r.certification)?.certification
	return rated ?? null
}

function extractTVRating(detail: TMDBTVDetailResponse): string | null {
	const us = detail.content_ratings?.results?.find(r => r.iso_3166_1 === 'US')
	return us?.rating ?? null
}

export function buildMovieDetail(
	detail: TMDBMovieDetailResponse,
	omdb: OMDBResponse | null
): MovieDetail {
	const ratings = extractRatings(omdb)
	ratings.tmdb = detail.vote_average ?? null

	return {
		...detail,
		genres: detail.genres ?? [],
		credits: {
			cast: detail.credits?.cast ?? [],
			crew: detail.credits?.crew ?? []
		},
		ratings,
		certification: extractCertification(detail),
		trailer: pickTrailer(detail.videos?.results ?? [])
	}
}

export function buildTVDetail(detail: TMDBTVDetailResponse): TVDetail {
	const ratings: AppRatings = { tmdb: detail.vote_average ?? null, rottenTomatoes: null, metacritic: null }

	return {
		...detail,
		genres: detail.genres ?? [],
		credits: {
			cast: detail.credits?.cast ?? [],
			crew: detail.credits?.crew ?? []
		},
		ratings,
		certification: extractTVRating(detail),
		trailer: pickTrailer(detail.videos?.results ?? [])
	}
}
