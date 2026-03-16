/**
 * Utilities for personalizing the "Related" section on detail pages.
 *
 * These helpers mirror parts of the home recommendations algorithm
 * (src/routes/api/recommendations/+server.ts) but are scoped to a
 * single item: they re-rank TMDB's native per-item recommendations
 * by blending item-level relevance with the user's genre preferences.
 */

/** Weighted genre-preference set derived from watchlist items.
 *  Items are assumed to be ordered most-recent-first. */
export function topGenreSet(
	items: Array<{ genre_ids: number[] }>,
	limit: number
): Set<number> {
	const scores = new Map<number, number>()
	for (let i = 0; i < items.length; i++) {
		const weight = Math.exp(-i / 30)
		for (const g of items[i].genre_ids ?? []) {
			if (typeof g === 'number') scores.set(g, (scores.get(g) ?? 0) + weight)
		}
	}
	const topIds = Array.from(scores.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([id]) => id)
	return new Set(topIds)
}

/** Fraction of a candidate's genres that overlap with the user's preference set. */
function prefOverlap(genres: number[], pref: Set<number>): number {
	if (!genres.length || pref.size === 0) return 0
	let hit = 0
	for (const g of genres) if (pref.has(g)) hit++
	return hit / genres.length
}

/**
 * Re-rank a merged pool of TMDB recommendations and keyword-discover results
 * using user genre preferences.
 *
 * Score weights (must sum to 1):
 *   0.55 × recRank       – position in TMDB's own recommendations (item-level relevance)
 *   0.30 × genreOverlap  – overlap with user's preferred genres (personalisation)
 *   0.15 × discoverRank  – bonus for also appearing in keyword-based discovery
 *
 * When the user has no watchlist the genre overlap is 0 for all candidates, so
 * the function degrades gracefully to TMDB recommendation order.
 */
export function rankRelated<T extends { id: number; genre_ids: number[] }>(
	tmdbRecs: T[],
	keywordDiscover: T[],
	userGenrePref: Set<number>,
	currentId: number
): T[] {
	type Candidate = { item: T; recRank: number; discoverRank: number; genreOverlap: number }
	const pool = new Map<number, Candidate>()

	for (let i = 0; i < tmdbRecs.length; i++) {
		const item = tmdbRecs[i]
		if (item.id === currentId) continue
		pool.set(item.id, {
			item,
			recRank: 1 / (i + 1),
			discoverRank: 0,
			genreOverlap: prefOverlap(item.genre_ids ?? [], userGenrePref)
		})
	}

	for (let i = 0; i < keywordDiscover.length; i++) {
		const item = keywordDiscover[i]
		if (item.id === currentId) continue
		const discoverRank = 1 / (i + 1)
		const genreOverlap = prefOverlap(item.genre_ids ?? [], userGenrePref)
		const existing = pool.get(item.id)
		if (existing) {
			// Only update the discover rank; genreOverlap is deterministic for a given item.
			existing.discoverRank = Math.max(existing.discoverRank, discoverRank)
		} else {
			pool.set(item.id, { item, recRank: 0, discoverRank, genreOverlap })
		}
	}

	return Array.from(pool.values())
		.map(c => ({
			item: c.item,
			score: 0.55 * c.recRank + 0.30 * c.genreOverlap + 0.15 * c.discoverRank
		}))
		.sort((a, b) => b.score - a.score)
		.map(x => x.item)
}
