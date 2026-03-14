import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getWatchlist } from '$lib/kv/watchlist'
import {
	discoverMovies,
	discoverTV,
	fetchMovieRecommendations,
	fetchTVRecommendations
} from '$lib/api/tmdb'
import type { TMDBMediaResult } from '$lib/types/tmdb'
import {
	getHomeRecommendationsCache,
	setHomeRecommendationsCache
} from '$lib/kv/recommendations'

const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const DEFAULT_LIMIT = 24

const SEED_WINDOW = 80
const SEEDS_PER_TYPE = 3
const REC_PER_SEED = 20
const REC_CONCURRENCY = 4

function parseLimit(url: URL): number {
	const raw = url.searchParams.get('limit')
	if (!raw) return DEFAULT_LIMIT
	const n = Number(raw)
	if (!Number.isFinite(n)) return DEFAULT_LIMIT
	return Math.max(1, Math.min(60, Math.floor(n)))
}

function topGenres(genreItems: Array<{ genre_ids: number[] }>, limit: number): number[] {
	// Assumes items are sorted by preference (most recent first).
	const scores = new Map<number, number>()
	for (let i = 0; i < genreItems.length; i++) {
		const item = genreItems[i]
		if (!Array.isArray(item.genre_ids) || item.genre_ids.length === 0) continue
		const weight = Math.exp(-i / 30)
		for (const genreId of item.genre_ids) {
			if (typeof genreId !== 'number') continue
			scores.set(genreId, (scores.get(genreId) ?? 0) + weight)
		}
	}
	return Array.from(scores.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([id]) => id)
}

function pickSeeds<T extends { genre_ids: number[] }>(items: T[], seedCount: number): T[] {
	const pool = items.slice(0, SEED_WINDOW)
	const picked: T[] = []
	const pickedGenres = new Set<number>()

	// Pass 1: try to maximize genre diversity.
	for (const item of pool) {
		if (picked.length >= seedCount) break
		const genres = Array.isArray(item.genre_ids) ? item.genre_ids : []
		const novel = genres.filter(g => typeof g === 'number' && !pickedGenres.has(g)).length
		if (picked.length === 0 || novel > 0) {
			picked.push(item)
			for (const g of genres) if (typeof g === 'number') pickedGenres.add(g)
		}
	}

	// Pass 2: fill remaining slots by recency.
	if (picked.length < seedCount) {
		for (const item of pool) {
			if (picked.length >= seedCount) break
			if (picked.includes(item)) continue
			picked.push(item)
		}
	}

	return picked
}

async function mapLimit<T, R>(
	items: T[],
	limit: number,
	fn: (item: T, index: number) => Promise<R>
): Promise<Array<PromiseSettledResult<R>>> {
	if (items.length === 0) return []
	const results: Array<PromiseSettledResult<R>> = new Array(items.length)
	let nextIndex = 0

	const worker = async () => {
		while (true) {
			const current = nextIndex++
			if (current >= items.length) return
			try {
				const value = await fn(items[current], current)
				results[current] = { status: 'fulfilled', value }
			} catch (reason) {
				results[current] = { status: 'rejected', reason }
			}
		}
	}

	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
	return results
}

function jaccard(a: number[] | undefined, b: number[] | undefined): number {
	const aSet = new Set((a ?? []).filter(n => typeof n === 'number'))
	const bSet = new Set((b ?? []).filter(n => typeof n === 'number'))
	if (aSet.size === 0 && bSet.size === 0) return 0
	let intersection = 0
	for (const x of aSet) if (bSet.has(x)) intersection++
	const union = aSet.size + bSet.size - intersection
	return union === 0 ? 0 : intersection / union
}

function prefOverlap(genres: number[] | undefined, pref: Set<number>): number {
	const list = (genres ?? []).filter(n => typeof n === 'number')
	if (list.length === 0 || pref.size === 0) return 0
	let hit = 0
	for (const g of list) if (pref.has(g)) hit++
	return hit / list.length
}

export const GET: RequestHandler = async ({ url, fetch }) => {
	const limit = parseLimit(url)

	const cached = await getHomeRecommendationsCache()
	if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
		return json(cached.items.slice(0, limit))
	}

	const watchlist = await getWatchlist()
	if (watchlist.length === 0) return json([])

	const inWatchlist = new Set(watchlist.map(i => `${i.mediaType}:${i.id}`))

	const movieItems = watchlist.filter(i => i.mediaType === 'movie')
	const tvItems = watchlist.filter(i => i.mediaType === 'tv')

	const movieGenres = topGenres(movieItems.slice(0, 200), 3)
	const tvGenres = topGenres(tvItems.slice(0, 200), 3)
	const moviePref = new Set(movieGenres)
	const tvPref = new Set(tvGenres)

	// If there are no genre IDs (e.g. imported items missing metadata), fall back to trending-like popularity.
	// We still run discover without with_genres to get a reasonable list.
	const movieGenreQueries = movieGenres.length ? movieGenres : [0]
	const tvGenreQueries = tvGenres.length ? tvGenres : [0]

	type CandidateStats = {
		item: TMDBMediaResult
		seedHitCount: number
		bestRecRank: number
		bestGenreOverlap: number
		bestDiscoverRank: number
	}
	const candidates = new Map<string, CandidateStats>()

	function upsert(mediaType: 'movie' | 'tv', raw: any): CandidateStats | null {
		const id = typeof raw?.id === 'number' ? raw.id : Number(raw?.id)
		if (!Number.isFinite(id)) return null
		const k = `${mediaType}:${id}`
		if (inWatchlist.has(k)) return null
		const existing = candidates.get(k)
		if (existing) {
			// Always keep media_type stable.
			if (existing.item.media_type !== mediaType) existing.item.media_type = mediaType
			return existing
		}
		const item: TMDBMediaResult = { ...raw, media_type: mediaType }
		const created: CandidateStats = {
			item,
			seedHitCount: 0,
			bestRecRank: 0,
			bestGenreOverlap: 0,
			bestDiscoverRank: 0
		}
		candidates.set(k, created)
		return created
	}

	function considerDiscover(mediaType: 'movie' | 'tv', raw: any, queryIndex: number, position: number) {
		const stats = upsert(mediaType, raw)
		if (!stats) return
		const genreWeight = 1 - queryIndex * 0.15 // 1.0, 0.85, 0.7
		const rankWeight = 1 / (position + 1)
		stats.bestDiscoverRank = Math.max(stats.bestDiscoverRank, genreWeight * rankWeight)
		const pref = mediaType === 'movie' ? moviePref : tvPref
		stats.bestGenreOverlap = Math.max(stats.bestGenreOverlap, prefOverlap(stats.item.genre_ids, pref))
	}

	function considerSeedRec(
		seedMediaType: 'movie' | 'tv',
		seedGenres: number[],
		raw: any,
		seedIndex: number,
		position: number,
		seenForSeed: Set<number>
	) {
		const stats = upsert(seedMediaType, raw)
		if (!stats) return
		const id = stats.item.id
		if (!seenForSeed.has(id)) {
			stats.seedHitCount += 1
			seenForSeed.add(id)
		}
		const seedWeight = 1 - seedIndex * 0.18 // 1.0, 0.82, 0.64
		const rankWeight = 1 / (position + 1)
		stats.bestRecRank = Math.max(stats.bestRecRank, seedWeight * rankWeight)

		const pref = seedMediaType === 'movie' ? moviePref : tvPref
		const overlap = 0.7 * jaccard(stats.item.genre_ids, seedGenres) + 0.3 * prefOverlap(stats.item.genre_ids, pref)
		stats.bestGenreOverlap = Math.max(stats.bestGenreOverlap, overlap)
	}

	const moviePromises = movieGenreQueries.map((g, idx) =>
		discoverMovies(
			{
				with_genres: g ? String(g) : undefined,
				sort_by: 'popularity.desc',
				page: 1,
				include_adult: false,
				'vote_count.gte': 50
			},
			fetch
		).then(results => ({ mediaType: 'movie' as const, idx, results }))
	)

	const tvPromises = tvGenreQueries.map((g, idx) =>
		discoverTV(
			{
				with_genres: g ? String(g) : undefined,
				sort_by: 'popularity.desc',
				page: 1,
				include_adult: false,
				'vote_count.gte': 50
			},
			fetch
		).then(results => ({ mediaType: 'tv' as const, idx, results }))
	)

	const settled = await Promise.allSettled([...moviePromises, ...tvPromises])
	for (const r of settled) {
		if (r.status !== 'fulfilled') continue
		const { mediaType, idx, results } = r.value
		for (let i = 0; i < results.length; i++) {
			const raw = results[i]
			considerDiscover(mediaType, raw, idx, i)
		}
	}

	// Add per-title recommendations from a small set of recent watchlist seeds.
	// This typically feels more personalized than genre-based discovery.
	const pendingFirst = watchlist
		.slice()
		.sort((a, b) => Number(a.onMediaServer) - Number(b.onMediaServer) || b.addedAt - a.addedAt)
	const seedMovies = pickSeeds(pendingFirst.filter(i => i.mediaType === 'movie'), SEEDS_PER_TYPE)
	const seedTV = pickSeeds(pendingFirst.filter(i => i.mediaType === 'tv'), SEEDS_PER_TYPE)

	const seedJobs = [
		...seedMovies.map((s, idx) => ({ mediaType: 'movie' as const, seed: s, seedIndex: idx })),
		...seedTV.map((s, idx) => ({ mediaType: 'tv' as const, seed: s, seedIndex: idx }))
	]

	const seedSettled = await mapLimit(seedJobs, REC_CONCURRENCY, async job => {
		return job.mediaType === 'movie'
			? fetchMovieRecommendations(job.seed.id, fetch)
			: fetchTVRecommendations(job.seed.id, fetch)
	})

	for (let i = 0; i < seedSettled.length; i++) {
		const r = seedSettled[i]
		if (r.status !== 'fulfilled') continue
		const job = seedJobs[i]
		const results = r.value
		const seenForSeed = new Set<number>()
		for (let pos = 0; pos < Math.min(results.length, REC_PER_SEED); pos++) {
			considerSeedRec(job.mediaType, job.seed.genre_ids ?? [], results[pos], job.seedIndex, pos, seenForSeed)
		}
	}

	const totalSeeds = seedJobs.length
	const ranked = Array.from(candidates.values())
		.map(s => {
			const freq = totalSeeds > 0 ? s.seedHitCount / totalSeeds : 0
			const voteCount = typeof s.item.vote_count === 'number' ? s.item.vote_count : 0
			const voteAvg = typeof s.item.vote_average === 'number' ? s.item.vote_average : 0
			const score =
				0.45 * freq +
				0.35 * s.bestRecRank +
				0.12 * s.bestGenreOverlap +
				0.08 * s.bestDiscoverRank +
				Math.log10(voteCount + 1) * 0.02 +
				(voteAvg / 10) * 0.03
			return { item: s.item, score }
		})
		.sort((a, b) => b.score - a.score)
		.map(x => x.item)

	if (ranked.length === 0) {
		// Likely a transient TMDB failure; don't cache emptiness.
		return json([])
	}

	const finalItems = ranked.slice(0, Math.max(limit, DEFAULT_LIMIT))
	await setHomeRecommendationsCache(finalItems)

	return json(finalItems.slice(0, limit))
}
