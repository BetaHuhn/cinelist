import type { WatchlistItem } from '$lib/types/app'

export interface GraphNode {
	id: string
	item: WatchlistItem
	x: number
	y: number
	vx: number
	vy: number
	pinned: boolean
}

export interface GraphEdge {
	source: string
	target: string
	sharedGenres: number[]
	weight: number
}

/** Movie and TV genre ID → display name (TMDB standard). */
export const GENRE_NAMES: Record<number, string> = {
	28: 'Action',
	12: 'Adventure',
	16: 'Animation',
	35: 'Comedy',
	80: 'Crime',
	99: 'Documentary',
	18: 'Drama',
	10751: 'Family',
	14: 'Fantasy',
	36: 'History',
	27: 'Horror',
	10402: 'Music',
	9648: 'Mystery',
	10749: 'Romance',
	878: 'Sci-Fi',
	53: 'Thriller',
	10752: 'War',
	37: 'Western',
	10759: 'Action & Adventure',
	10762: 'Kids',
	10763: 'News',
	10764: 'Reality',
	10765: 'Sci-Fi & Fantasy',
	10766: 'Soap',
	10767: 'Talk',
	10768: 'War & Politics'
}

/** Genre ID → colour (distinct palette for legibility on dark backgrounds). */
export const GENRE_COLORS: Record<number, string> = {
	// Movie genres
	28: '#ef4444',    // Action             – red
	12: '#f97316',    // Adventure          – orange
	16: '#eab308',    // Animation          – yellow
	35: '#22c55e',    // Comedy             – green
	80: '#6366f1',    // Crime              – indigo
	99: '#06b6d4',    // Documentary        – cyan
	18: '#8b5cf6',    // Drama              – violet
	10751: '#f59e0b', // Family             – amber
	14: '#a855f7',    // Fantasy            – purple
	36: '#84cc16',    // History            – lime
	27: '#dc2626',    // Horror             – dark red
	10402: '#ec4899', // Music              – pink
	9648: '#3b82f6',  // Mystery            – blue
	10749: '#f43f5e', // Romance            – rose
	878: '#0ea5e9',   // Sci-Fi             – sky
	53: '#fb923c',    // Thriller           – light orange (distinct from Adventure)
	10752: '#78716c', // War                – stone
	37: '#d97706',    // Western            – dark amber
	// TV-only genres
	10759: '#b91c1c', // Action & Adventure – dark red (distinct from Action)
	10762: '#ca8a04', // Kids               – dark yellow (distinct from Animation)
	10764: '#16a34a', // Reality            – dark green (distinct from Comedy)
	10765: '#0284c7', // Sci-Fi & Fantasy   – dark sky (distinct from Sci-Fi)
	10767: '#0891b2', // Talk               – dark cyan (distinct from Documentary)
	10768: '#57534e'  // War & Politics     – darker stone (distinct from War)
}

/** Return the colour for a watchlist item based on its first recognisable genre. */
export function getNodeColor(item: WatchlistItem): string {
	for (const g of item.genre_ids) {
		if (GENRE_COLORS[g]) return GENRE_COLORS[g]
	}
	return item.mediaType === 'tv' ? '#8b5cf6' : '#f59e0b'
}

/**
 * Build graph nodes and edges from a watchlist.
 *
 * Edges are created for any two items that share at least `minShared` genres.
 * The threshold is raised automatically to keep the graph readable when the
 * raw edge count would be very large.
 */
export function buildGraph(
	items: WatchlistItem[],
	cx: number,
	cy: number
): { nodes: GraphNode[]; edges: GraphEdge[] } {
	const nodes: GraphNode[] = items.map((item, i) => {
		const angle = (i / Math.max(items.length, 1)) * 2 * Math.PI
		const r = 60 + Math.min(items.length, 24) * 7
		return {
			id: `${item.mediaType}:${item.id}`,
			item,
			x: cx + r * Math.cos(angle) + (Math.random() - 0.5) * 30,
			y: cy + r * Math.sin(angle) + (Math.random() - 0.5) * 30,
			vx: 0,
			vy: 0,
			pinned: false
		}
	})

	// Build all candidate edges
	const candidates: GraphEdge[] = []
	for (let i = 0; i < items.length; i++) {
		for (let j = i + 1; j < items.length; j++) {
			const a = items[i]
			const b = items[j]
			const shared = a.genre_ids.filter((g) => b.genre_ids.includes(g))
			if (shared.length > 0) {
				candidates.push({
					source: `${a.mediaType}:${a.id}`,
					target: `${b.mediaType}:${b.id}`,
					sharedGenres: shared,
					weight: shared.length
				})
			}
		}
	}

	// Raise minimum threshold automatically so the graph stays readable
	let minShared = 1
	if (candidates.length > 300) minShared = 2
	if (candidates.length > 800) minShared = 3

	const edges = candidates.filter((e) => e.weight >= minShared)

	return { nodes, edges }
}
