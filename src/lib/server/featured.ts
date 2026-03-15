import type { FeaturedItem, FeaturedStatus } from '$lib/types/featured'
import type { WatchlistItem } from '$lib/types/app'
import { fetchMovieDetail, fetchTVDetail } from '$lib/api/tmdb'

function topGenres(items: WatchlistItem[], limit: number): number[] {
	// Assumes items are sorted by preference (most recent first).
	const scores = new Map<number, number>()
	for (let i = 0; i < items.length; i++) {
		const item = items[i]
		const genres = Array.isArray(item.genre_ids) ? item.genre_ids : []
		if (genres.length === 0) continue
		const weight = Math.exp(-i / 30)
		for (const genreId of genres) {
			if (typeof genreId !== 'number') continue
			scores.set(genreId, (scores.get(genreId) ?? 0) + weight)
		}
	}
	return Array.from(scores.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([id]) => id)
}

function prefOverlap(genres: number[] | undefined, pref: Set<number>): number {
	const list = (genres ?? []).filter(n => typeof n === 'number')
	if (list.length === 0 || pref.size === 0) return 0
	let hit = 0
	for (const g of list) if (pref.has(g)) hit++
	return hit / list.length
}

function clamp01(n: number): number {
	if (!Number.isFinite(n)) return 0
	return Math.max(0, Math.min(1, n))
}

function featuredScore(item: WatchlistItem, pref: Set<number>, now: number): number {
	const overlap = prefOverlap(item.genre_ids, pref) // 0..1
	const rating = clamp01((item.vote_average ?? 0) / 10) // 0..1
	const ageDays = Math.max(0, (now - (item.addedAt ?? now)) / (1000 * 60 * 60 * 24))
	const recency = Math.exp(-ageDays / 45) // ~1 for recent, decays over time
	return overlap * 0.55 + rating * 0.35 + recency * 0.1
}

export async function getFeaturedFromWatchlist(
	items: WatchlistItem[],
	fetchFn: typeof fetch,
	limit = 8
): Promise<FeaturedItem[]> {
	const LIMIT = Math.max(1, Math.min(12, Math.floor(limit)))
	const now = Date.now()

	const movieItems = items.filter(i => i.mediaType === 'movie')
	const tvItems = items.filter(i => i.mediaType === 'tv')
	const moviePref = new Set(topGenres(movieItems.slice(0, 200), 5))
	const tvPref = new Set(topGenres(tvItems.slice(0, 200), 5))

	const ready = items.filter(i => i.onMediaServer && !i.watched)
	const pending = items.filter(i => !i.onMediaServer && !i.watched)

	const scoreFor = (item: WatchlistItem) =>
		featuredScore(item, item.mediaType === 'tv' ? tvPref : moviePref, now)

	const readySeeds = ready
		.map(item => ({ item, score: scoreFor(item) }))
		.sort((a, b) => b.score - a.score)
		.slice(0, LIMIT)
		.map(({ item }) => item)

	const remaining = LIMIT - readySeeds.length
	const pendingSeeds = remaining > 0
		? pending
				.filter(p => !readySeeds.some(r => r.mediaType === p.mediaType && r.id === p.id))
				.map(item => ({ item, score: scoreFor(item) }))
				.sort((a, b) => b.score - a.score)
				.slice(0, remaining)
				.map(({ item }) => item)
		: []

	const seeds = [...readySeeds, ...pendingSeeds].slice(0, LIMIT)

	return Promise.all(
		seeds.map(async (seed) => {
			const status: FeaturedStatus = seed.onMediaServer ? 'ready' : 'pending'
			if (seed.mediaType === 'tv') {
				try {
					const detail = await fetchTVDetail(seed.id, fetchFn)
					const creator = detail.created_by?.[0]?.name ?? null
					const director = (detail.credits?.crew ?? []).find(c => c?.job === 'Director')?.name ?? null
					return {
						mediaType: 'tv',
						id: seed.id,
						title: detail.name ?? seed.title,
						poster_path: detail.poster_path ?? seed.poster_path,
						backdrop_path: detail.backdrop_path ?? seed.backdrop_path,
						release_date: detail.first_air_date ?? seed.release_date,
						vote_average: typeof detail.vote_average === 'number' ? detail.vote_average : seed.vote_average,
						overview: detail.overview ?? '',
						byline: creator ?? director,
						status
					} satisfies FeaturedItem
				} catch {
					return {
						mediaType: 'tv',
						id: seed.id,
						title: seed.title,
						poster_path: seed.poster_path,
						backdrop_path: seed.backdrop_path,
						release_date: seed.release_date,
						vote_average: seed.vote_average,
						overview: '',
						byline: null,
						status
					} satisfies FeaturedItem
				}
			}

			try {
				const detail = await fetchMovieDetail(seed.id, fetchFn)
				const director = (detail.credits?.crew ?? []).find(c => c?.job === 'Director')?.name ?? null
				return {
					mediaType: 'movie',
					id: seed.id,
					title: detail.title ?? seed.title,
					poster_path: detail.poster_path ?? seed.poster_path,
					backdrop_path: detail.backdrop_path ?? seed.backdrop_path,
					release_date: detail.release_date ?? seed.release_date,
					vote_average: typeof detail.vote_average === 'number' ? detail.vote_average : seed.vote_average,
					overview: detail.overview ?? '',
					byline: director,
					status
				} satisfies FeaturedItem
			} catch {
				return {
					mediaType: 'movie',
					id: seed.id,
					title: seed.title,
					poster_path: seed.poster_path,
					backdrop_path: seed.backdrop_path,
					release_date: seed.release_date,
					vote_average: seed.vote_average,
					overview: '',
					byline: null,
					status
				} satisfies FeaturedItem
			}
		})
	)
}
