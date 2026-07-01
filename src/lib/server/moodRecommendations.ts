import type { WatchlistItem } from '$lib/types/app'
import type { TMDBMediaResult } from '$lib/types/tmdb'

export type MoodKey = 'cozy' | 'adventurous' | 'exciting' | 'thoughtful' | 'uplifting' | 'funny' | 'tense' | 'classics'

export interface MoodOption {
	key: MoodKey
	label: string
	description: string
	genreIds: number[]
	/** Only set for moods defined by era rather than genre (e.g. classics) —
	 *  requires the title to be at least this many years old, spanning every genre. */
	minAgeYears?: number
	accent: string
}

export interface MoodRecommendationCandidate {
	mediaType: 'movie' | 'tv'
	id: number
	title: string
	poster_path: string | null
	backdrop_path: string | null
	release_date: string
	vote_average: number
	overview: string
	genre_ids: number[]
	onMediaServer: boolean
	watched: boolean
	userRating: number | null
	score: number
	matchedGenres: number[]
	source: 'watchlist' | 'fallback'
}

// Every movie genre is assigned to exactly one mood below (Drama, Documentary,
// and History all live under Thoughtful; Action/Thriller/War under Exciting;
// Crime/Horror/Mystery under Tense — the two are otherwise identical "intense"
// genres, split instead by adrenaline-vs-fear). The only two intentional
// repeats are Animation (Cozy + Funny — animated comedies fit both) and Comedy
// (Uplifting + Funny — feel-good comedy fits both); every other pair of moods
// shares zero genres. Genre-only matching also can't tell "cozy" apart from
// "heavy" within a genre (e.g. Drama), so a near-universal tag like Drama is
// deliberately confined to a single mood rather than spread across several.
export const moodOptions: MoodOption[] = [
	{
		key: 'cozy',
		label: 'Cozy',
		description: 'Warm, comforting, easy to sink into',
		genreIds: [10751, 16, 10762], // Family, Animation, Kids (TV)
		accent: 'from-amber-500/25 to-rose-500/15'
	},
	{
		key: 'adventurous',
		label: 'Adventurous',
		description: 'Big energy, exploration, and momentum',
		genreIds: [12, 14, 878, 37], // Adventure, Fantasy, Sci-Fi, Western
		accent: 'from-emerald-500/25 to-cyan-500/15'
	},
	{
		key: 'exciting',
		label: 'Exciting',
		description: 'Fast-paced and intense for a night in',
		genreIds: [28, 53, 10752], // Action, Thriller, War
		accent: 'from-fuchsia-500/25 to-orange-500/15'
	},
	{
		key: 'thoughtful',
		label: 'Thoughtful',
		description: 'Reflective, intimate, and emotionally rich',
		genreIds: [18, 99, 36], // Drama, Documentary, History
		accent: 'from-sky-500/25 to-violet-500/15'
	},
	{
		key: 'uplifting',
		label: 'Uplifting',
		description: 'Bright, hopeful, and fun',
		genreIds: [10402, 10749, 35], // Music, Romance, Comedy
		accent: 'from-lime-500/25 to-amber-500/15'
	},
	{
		key: 'funny',
		label: 'Funny',
		description: 'Easy laughs and feel-good comedy',
		genreIds: [35, 16, 10764], // Comedy, Animation, Reality (TV)
		accent: 'from-violet-500/25 to-pink-500/15'
	},
	{
		key: 'tense',
		label: 'Tense',
		description: 'Suspenseful, sharp, and edge-of-your-seat',
		genreIds: [80, 27, 9648], // Crime, Horror, Mystery
		accent: 'from-red-500/25 to-purple-500/15'
	},
	{
		key: 'classics',
		label: 'Classics',
		description: 'Timeless favorites that still hold up',
		genreIds: [], // spans every genre — defined by era, not genre
		minAgeYears: 25,
		accent: 'from-stone-400/25 to-amber-600/15'
	}
]

export function isMoodKey(key: string | null | undefined): key is MoodKey {
	return typeof key === 'string' && moodOptions.some(option => option.key === key)
}

function normalizeMood(key: string): MoodKey {
	return isMoodKey(key) ? key : 'cozy'
}

function toTitle(item: WatchlistItem | TMDBMediaResult): string {
	return 'title' in item ? item.title : item.name
}

function toReleaseDate(item: WatchlistItem | TMDBMediaResult): string {
	return 'release_date' in item ? item.release_date : item.first_air_date
}

function genreOverlap(genres: number[] | undefined, moodGenres: number[]): number {
	const list = (genres ?? []).filter((genre): genre is number => typeof genre === 'number')
	if (list.length === 0 || moodGenres.length === 0) return 0
	const overlap = list.filter(genre => moodGenres.includes(genre)).length
	return overlap / moodGenres.length
}

// Moods defined by era (e.g. classics) have an empty genreIds list, so genre
// overlap alone would always read as zero. Treat "no genre restriction" as a
// full, neutral match instead of a non-match.
function genreMatchScore(genres: number[] | undefined, mood: MoodOption): number {
	if (mood.genreIds.length === 0) return 1
	return genreOverlap(genres, mood.genreIds)
}

function releaseYear(dateStr: string | null | undefined): number | null {
	if (!dateStr) return null
	const year = new Date(dateStr).getFullYear()
	return Number.isNaN(year) ? null : year
}

function matchesEra(dateStr: string | null | undefined, mood: MoodOption, now: number): boolean {
	if (!mood.minAgeYears) return true
	const year = releaseYear(dateStr)
	if (year === null) return false
	const currentYear = new Date(now).getFullYear()
	return currentYear - year >= mood.minAgeYears
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value))
}

function scoreCandidate(item: WatchlistItem, mood: MoodOption, now: number): number {
	const moodMatch = genreMatchScore(item.genre_ids, mood)
	const rating = item.userRating != null ? clamp01(item.userRating / 10) : 0.5
	const readyBonus = item.onMediaServer ? 0.25 : 0
	const recency = Math.exp(-Math.max(0, (now - (item.addedAt ?? now)) / (1000 * 60 * 60 * 24)) / 45)
	const popularity = clamp01((item.vote_average ?? 0) / 10)

	return moodMatch * 0.5 + rating * 0.2 + readyBonus + popularity * 0.15 + recency * 0.1
}

function scoreFallbackCandidate(item: TMDBMediaResult, mood: MoodOption): number {
	const moodMatch = genreMatchScore(item.genre_ids, mood)
	const popularity = clamp01((item.vote_average ?? 0) / 10)
	const hasOverview = item.overview?.trim() ? 0.05 : 0
	return moodMatch * 0.6 + popularity * 0.25 + hasOverview
}

export function buildMoodRecommendations(
	watchlistItems: WatchlistItem[],
	moodKey: string,
	fallbackItems: TMDBMediaResult[] = []
): MoodRecommendationCandidate[] {
	const mood = moodOptions.find(option => option.key === normalizeMood(moodKey)) ?? moodOptions[0]
	const now = Date.now()

	// Every unwatched watchlist title that actually matches this mood's genres
	// (and, for era-based moods like classics, its age requirement) is
	// included, uncapped, so shuffle can draw from the whole library rather
	// than a truncated top slice.
	const scoredWatchlist = watchlistItems
		.filter(item => !item.watched
			&& genreMatchScore(item.genre_ids, mood) > 0
			&& matchesEra(item.release_date, mood, now))
		.map(item => ({
			item,
			score: scoreCandidate(item, mood, now),
			matchedGenres: (item.genre_ids ?? []).filter(genre => mood.genreIds.includes(genre))
		}))
		.sort((a, b) => b.score - a.score)

	const watchlistCandidates = scoredWatchlist.map(({ item, score, matchedGenres }) => ({
		mediaType: item.mediaType,
		id: item.id,
		title: item.title,
		poster_path: item.poster_path,
		backdrop_path: item.backdrop_path,
		release_date: item.release_date,
		vote_average: item.vote_average,
		overview: '',
		genre_ids: item.genre_ids,
		onMediaServer: item.onMediaServer,
		watched: item.watched,
		userRating: item.userRating,
		score,
		matchedGenres,
		source: 'watchlist' as const
	}))

	const fallbackPoolSize = 24
	const fallback = (fallbackItems ?? [])
		.filter(item => matchesEra(toReleaseDate(item), mood, now))
		.map(item => ({
			item,
			score: scoreFallbackCandidate(item, mood),
			matchedGenres: (item.genre_ids ?? []).filter(genre => mood.genreIds.includes(genre))
		}))
		.sort((a, b) => b.score - a.score)
		.slice(0, fallbackPoolSize)
		.map(({ item, score, matchedGenres }) => ({
			mediaType: item.media_type,
			id: item.id,
			title: toTitle(item),
			poster_path: item.poster_path,
			backdrop_path: item.backdrop_path,
			release_date: toReleaseDate(item),
			vote_average: item.vote_average,
			overview: item.overview ?? '',
			genre_ids: item.genre_ids,
			onMediaServer: false,
			watched: false,
			userRating: null,
			score,
			matchedGenres,
			source: 'fallback' as const
		}))

	return [...watchlistCandidates, ...fallback].sort((a, b) => b.score - a.score)
}
