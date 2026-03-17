import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { dev } from '$app/environment'
import { getWatchlist } from '$lib/kv/watchlist'
import { getFavoritePeople } from '$lib/kv/people'
import {
	discoverMovies,
	discoverTV,
	fetchMovieRecommendations,
	fetchTVRecommendations,
	fetchMovieKeywords,
	fetchTVKeywords
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

const KEYWORDS_PER_TYPE = 10
const KEYWORD_QUERIES_PER_TYPE = 2
const KEYWORD_CONCURRENCY = 4

const PEOPLE_IDS_PER_QUERY = 5

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

/** Number of items stored in the cache — large enough to give the discover
 *  feature a deep pool without exhausting results quickly, while keeping each
 *  slimmed item ≈ 300 bytes well under Deno KV's 64 KB per-value limit.
 *  At ~300 bytes/item this yields ~18 KB total for the cached payload. */
const CACHE_SIZE = 60

export const GET: RequestHandler = async ({ url, fetch }) => {
	const limit = parseLimit(url)
	const debug = dev && url.searchParams.get('debug') === '1'
	// `?fresh=1` lets the discover endpoint bypass the cache when the pool is exhausted.
	const fresh = !debug && url.searchParams.get('fresh') === '1'

	// Debug and fresh responses should reflect the current watchlist/seed selection.
	if (!debug && !fresh) {
		const cached = await getHomeRecommendationsCache()
		if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
			return json(cached.items.slice(0, limit))
		}
	}

	const watchlist = await getWatchlist()
	if (watchlist.length === 0) return json([])

	const favoritePeople = await getFavoritePeople().catch(() => [])

	const inWatchlist = new Set(watchlist.map(i => `${i.mediaType}:${i.id}`))

	const movieItems = watchlist.filter(i => i.mediaType === 'movie')
	const tvItems = watchlist.filter(i => i.mediaType === 'tv')

	const movieGenres = topGenres(movieItems.slice(0, 200), 3)
	const tvGenres = topGenres(tvItems.slice(0, 200), 3)
	const moviePref = new Set(movieGenres)
	const tvPref = new Set(tvGenres)
	const movieGenreOr = movieGenres.length ? movieGenres.join('|') : undefined
	const tvGenreOr = tvGenres.length ? tvGenres.join('|') : undefined

	// If there are no genre IDs (e.g. imported items missing metadata), fall back to trending-like popularity.
	// We still run discover without with_genres to get a reasonable list.
	const movieGenreQueries = movieGenres.length ? movieGenres : [0]
	const tvGenreQueries = tvGenres.length ? tvGenres : [0]

	type SeedDebug = { mediaType: 'movie' | 'tv'; id: number; title: string; seedIndex: number }

	type CandidateDebug = {
		seedSources: Map<string, { mediaType: 'movie' | 'tv'; id: number; title: string; bestPos: number; seedIndex: number }>
		keywordSources: Set<number>
		discoverSources: Array<{ kind: 'genre' | 'keyword' | 'person'; id?: number; idx: number }>
		components?: {
			freq: number
			bestRecRank: number
			bestGenreOverlap: number
			bestDiscoverRank: number
			voteCount: number
			voteAvg: number
			popularity: number
			score: number
		}
	}

	type CandidateStats = {
		item: TMDBMediaResult
		seedHitCount: number
		bestRecRank: number
		bestGenreOverlap: number
		bestDiscoverRank: number
		debug?: CandidateDebug
	}
	const candidates = new Map<string, CandidateStats>()
	const keywordNameById = debug ? new Map<number, string>() : null
	const seedDebugList: SeedDebug[] = []

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
			bestDiscoverRank: 0,
			...(debug
				? {
					debug: {
						seedSources: new Map(),
						keywordSources: new Set(),
						discoverSources: []
					}
				}
				: {})
		}
		candidates.set(k, created)
		return created
	}

	function considerDiscoverGenre(mediaType: 'movie' | 'tv', raw: any, queryIndex: number, position: number) {
		const stats = upsert(mediaType, raw)
		if (!stats) return
		const genreWeight = 1 - queryIndex * 0.15 // 1.0, 0.85, 0.7
		const rankWeight = 1 / (position + 1)
		stats.bestDiscoverRank = Math.max(stats.bestDiscoverRank, genreWeight * rankWeight)
		const pref = mediaType === 'movie' ? moviePref : tvPref
		stats.bestGenreOverlap = Math.max(stats.bestGenreOverlap, prefOverlap(stats.item.genre_ids, pref))
		if (debug && stats.debug) stats.debug.discoverSources.push({ kind: 'genre', idx: queryIndex })
	}

	function considerDiscoverPerson(
		mediaType: 'movie' | 'tv',
		raw: any,
		queryIndex: number,
		position: number,
		seedPersonId?: number
	) {
		const stats = upsert(mediaType, raw)
		if (!stats) return
		// Keep this influence small; it's an extra nudge on top of the existing signals.
		const peopleWeight = 0.45
		const rankWeight = 1 / (position + 1)
		stats.bestDiscoverRank = Math.max(stats.bestDiscoverRank, peopleWeight * rankWeight)
		const pref = mediaType === 'movie' ? moviePref : tvPref
		stats.bestGenreOverlap = Math.max(stats.bestGenreOverlap, prefOverlap(stats.item.genre_ids, pref))
		if (debug && stats.debug) stats.debug.discoverSources.push({ kind: 'person', id: seedPersonId, idx: queryIndex })
	}

	function considerDiscoverKeyword(
		mediaType: 'movie' | 'tv',
		raw: any,
		keywordId: number,
		queryIndex: number,
		position: number
	) {
		const stats = upsert(mediaType, raw)
		if (!stats) return
		const genreWeight = 1 - queryIndex * 0.15
		const rankWeight = 1 / (position + 1)
		stats.bestDiscoverRank = Math.max(stats.bestDiscoverRank, genreWeight * rankWeight)
		const pref = mediaType === 'movie' ? moviePref : tvPref
		stats.bestGenreOverlap = Math.max(stats.bestGenreOverlap, prefOverlap(stats.item.genre_ids, pref))
		if (debug && stats.debug) {
			stats.debug.keywordSources.add(keywordId)
			stats.debug.discoverSources.push({ kind: 'keyword', id: keywordId, idx: queryIndex })
		}
	}

	function considerSeedRec(
		seedMediaType: 'movie' | 'tv',
		seedGenres: number[],
		seedId: number,
		seedTitle: string,
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

		if (debug && stats.debug) {
			const seedKey = `${seedMediaType}:${seedId}`
			const existing = stats.debug.seedSources.get(seedKey)
			if (!existing || position < existing.bestPos) {
				stats.debug.seedSources.set(seedKey, {
					mediaType: seedMediaType,
					id: seedId,
					title: seedTitle,
					bestPos: position,
					seedIndex
				})
			}
		}
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
			considerDiscoverGenre(mediaType, raw, idx, i)
		}
	}

	// Small "favorite people" influence: add a single discover query seeded by favorited people.
	const favoriteIds = favoritePeople
		.slice(0, PEOPLE_IDS_PER_QUERY)
		.map(p => p.id)
		.filter(id => typeof id === 'number' && Number.isFinite(id))
	const peopleOr = favoriteIds.length ? favoriteIds.join('|') : undefined
	if (peopleOr) {
		const personSeedId = favoriteIds[0]
		const peopleSettled = await Promise.allSettled([
			discoverMovies(
				{
					with_people: peopleOr,
					with_genres: movieGenreOr,
					sort_by: 'popularity.desc',
					page: 1,
					include_adult: false,
					'vote_count.gte': 25
				},
				fetch
			),
			discoverTV(
				{
					with_people: peopleOr,
					with_genres: tvGenreOr,
					sort_by: 'popularity.desc',
					page: 1,
					include_adult: false,
					'vote_count.gte': 25
				},
				fetch
			)
		])
		if (peopleSettled[0]?.status === 'fulfilled') {
			const results = peopleSettled[0].value
			for (let pos = 0; pos < results.length; pos++) considerDiscoverPerson('movie', results[pos], 0, pos, personSeedId)
		}
		if (peopleSettled[1]?.status === 'fulfilled') {
			const results = peopleSettled[1].value
			for (let pos = 0; pos < results.length; pos++) considerDiscoverPerson('tv', results[pos], 0, pos, personSeedId)
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
	if (debug) {
		for (const job of seedJobs) {
			seedDebugList.push({
				mediaType: job.mediaType,
				id: job.seed.id,
				title: job.seed.title,
				seedIndex: job.seedIndex
			})
		}
	}

	// Keyword-based personalization: fetch keywords for seed items and use them as additional discover queries.
	const keywordSettled = await mapLimit(seedJobs, KEYWORD_CONCURRENCY, async job => {
		return job.mediaType === 'movie'
			? fetchMovieKeywords(job.seed.id, fetch)
			: fetchTVKeywords(job.seed.id, fetch)
	})

	const movieKeywordScores = new Map<number, number>()
	const tvKeywordScores = new Map<number, number>()
	for (let i = 0; i < keywordSettled.length; i++) {
		const r = keywordSettled[i]
		if (r.status !== 'fulfilled') continue
		const job = seedJobs[i]
		const weight = 1 - job.seedIndex * 0.2
		const target = job.mediaType === 'movie' ? movieKeywordScores : tvKeywordScores
		for (const kw of r.value) {
			if (!kw || typeof kw.id !== 'number') continue
			if (debug && keywordNameById) keywordNameById.set(kw.id, typeof kw.name === 'string' ? kw.name : String(kw.id))
			target.set(kw.id, (target.get(kw.id) ?? 0) + weight)
		}
	}

	const topMovieKeywordIds = Array.from(movieKeywordScores.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, KEYWORDS_PER_TYPE)
		.map(([id]) => id)
	const topTVKeywordIds = Array.from(tvKeywordScores.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, KEYWORDS_PER_TYPE)
		.map(([id]) => id)

	const movieKeywordQueries = topMovieKeywordIds.slice(0, KEYWORD_QUERIES_PER_TYPE)
	const tvKeywordQueries = topTVKeywordIds.slice(0, KEYWORD_QUERIES_PER_TYPE)

	const keywordMoviePromises = movieKeywordQueries.map((kw, idx) =>
		discoverMovies(
			{
				with_keywords: String(kw),
				with_genres: movieGenreOr,
				sort_by: 'vote_average.desc',
				page: 1,
				include_adult: false,
				'vote_count.gte': 25
			},
			fetch
		).then(results => ({ mediaType: 'movie' as const, idx, results }))
	)

	const keywordTVPromises = tvKeywordQueries.map((kw, idx) =>
		discoverTV(
			{
				with_keywords: String(kw),
				with_genres: tvGenreOr,
				sort_by: 'vote_average.desc',
				page: 1,
				include_adult: false,
				'vote_count.gte': 25
			},
			fetch
		).then(results => ({ mediaType: 'tv' as const, idx, results }))
	)

	const keywordDiscoverSettled = await Promise.allSettled([
		...keywordMoviePromises,
		...keywordTVPromises
	])
	for (const r of keywordDiscoverSettled) {
		if (r.status !== 'fulfilled') continue
		const { mediaType, idx, results } = r.value
		const keywordId = mediaType === 'movie' ? movieKeywordQueries[idx] : tvKeywordQueries[idx]
		for (let pos = 0; pos < results.length; pos++) {
			considerDiscoverKeyword(mediaType, results[pos], keywordId, idx, pos)
		}
	}

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
			considerSeedRec(
				job.mediaType,
				job.seed.genre_ids ?? [],
				job.seed.id,
				job.seed.title,
				results[pos],
				job.seedIndex,
				pos,
				seenForSeed
			)
		}
	}

	const totalSeeds = seedJobs.length
	const ranked = Array.from(candidates.values())
		.map(s => {
			const freq = totalSeeds > 0 ? s.seedHitCount / totalSeeds : 0
			const voteCount = typeof s.item.vote_count === 'number' ? s.item.vote_count : 0
			const voteAvg = typeof s.item.vote_average === 'number' ? s.item.vote_average : 0
			const popularity = typeof (s.item as any).popularity === 'number' ? (s.item as any).popularity : 0
			// Small tuning pass: reduce popularity bias and slightly favor well-rated, less-mainstream titles.
			const score =
				0.45 * freq +
				0.35 * s.bestRecRank +
				0.12 * s.bestGenreOverlap +
				0.08 * s.bestDiscoverRank +
				Math.log10(voteCount + 1) * 0.005 +
				(voteAvg / 10) * 0.05 -
				Math.log10(popularity + 1) * 0.02
			if (debug && s.debug) {
				s.debug.components = {
					freq,
					bestRecRank: s.bestRecRank,
					bestGenreOverlap: s.bestGenreOverlap,
					bestDiscoverRank: s.bestDiscoverRank,
					voteCount,
					voteAvg,
					popularity,
					score
				}
			}
			return { item: s.item, score }
		})
		.sort((a, b) => b.score - a.score)
		.map(x => x.item)

	if (ranked.length === 0) {
		// Likely a transient TMDB failure; don't cache emptiness.
		return json([])
	}

	const finalItems = ranked.slice(0, CACHE_SIZE)
	if (!debug) await setHomeRecommendationsCache(finalItems)

	if (debug) {
		const items = finalItems.slice(0, limit)
		const debugItems = items.map(it => {
			const key = `${it.media_type}:${it.id}`
			const stats = candidates.get(key)
			const d = stats?.debug
			const seedSources = d
				? Array.from(d.seedSources.values())
					.sort((a, b) => a.seedIndex - b.seedIndex || a.bestPos - b.bestPos)
					.map(s => ({ mediaType: s.mediaType, id: s.id, title: s.title, bestPos: s.bestPos }))
				: []
			const keywordSources = d
				? Array.from(d.keywordSources)
					.map(id => ({ id, name: keywordNameById?.get(id) ?? String(id) }))
					.sort((a, b) => a.name.localeCompare(b.name))
				: []
			const discover = d?.discoverSources ?? []
			const via = {
				seedRecommendations: (stats?.bestRecRank ?? 0) > 0,
				genreDiscover: discover.some(s => s.kind === 'genre'),
				keywordDiscover: discover.some(s => s.kind === 'keyword'),
				personDiscover: discover.some(s => s.kind === 'person')
			}
			return {
				key,
				seedHitCount: stats?.seedHitCount ?? 0,
				via,
				seedSources,
				keywordSources,
				components: d?.components ?? null
			}
		})

		const topKeywords = {
			movie: Array.from(movieKeywordScores.entries())
				.sort((a, b) => b[1] - a[1])
				.slice(0, KEYWORDS_PER_TYPE)
				.map(([id, score]) => ({ id, name: keywordNameById?.get(id) ?? String(id), score })),
			tv: Array.from(tvKeywordScores.entries())
				.sort((a, b) => b[1] - a[1])
				.slice(0, KEYWORDS_PER_TYPE)
				.map(([id, score]) => ({ id, name: keywordNameById?.get(id) ?? String(id), score }))
		}

		return json({
			items,
			debug: {
				seeds: seedDebugList,
				topGenres: { movie: movieGenres, tv: tvGenres },
				topKeywords
			},
			debugItems
		})
	}

	return json(finalItems.slice(0, limit))
}
