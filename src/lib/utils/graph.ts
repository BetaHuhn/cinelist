import type { WatchlistItem } from '$lib/types/app'

export interface GraphNode {
id: string
item: WatchlistItem
/** Set by d3-force during simulation */
x: number
y: number
vx?: number
vy?: number
/** When non-null, d3-force pins the node at this coordinate */
fx?: number | null
fy?: number | null
}

export interface GraphEdge {
source: string | GraphNode
target: string | GraphNode
sharedGenres: number[]
sharedKeywords: number[]
/** Combined edge strength: sharedGenres*2 + sharedKeywords */
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

/** Return the primary colour for a watchlist item based on its first recognisable genre. */
export function getNodeColor(item: WatchlistItem): string {
for (const g of item.genre_ids) {
if (GENRE_COLORS[g]) return GENRE_COLORS[g]
}
return item.mediaType === 'tv' ? '#8b5cf6' : '#f59e0b'
}

/**
 * Build graph nodes and edges from a watchlist.
 *
 * Edges are created for any two items that share genres or keywords.
 * Edge weight = sharedGenres × GENRE_EDGE_WEIGHT + sharedKeywords × KEYWORD_EDGE_WEIGHT. An auto-adaptive
 * minimum weight threshold keeps the graph readable for large libraries.
 *
 * @param items     Watchlist items to visualise.
 * @param cx        Initial horizontal centre for the circular layout.
 * @param cy        Initial vertical centre for the circular layout.
 * @param keywordMap  Optional map of "mediaType:id" → keyword ID array.
 */

/** Weight contribution of each shared genre ID toward the edge weight. */
const GENRE_EDGE_WEIGHT = 2
/** Weight contribution of each shared keyword ID toward the edge weight. */
const KEYWORD_EDGE_WEIGHT = 1

export function buildGraph(
items: WatchlistItem[],
cx: number,
cy: number,
keywordMap?: Map<string, number[]>
): { nodes: GraphNode[]; edges: GraphEdge[] } {
const n = items.length
const nodes: GraphNode[] = items.map((item, i) => {
const angle = (i / Math.max(n, 1)) * 2 * Math.PI
const r = 60 + Math.min(n, 24) * 7
return {
id: `${item.mediaType}:${item.id}`,
item,
x: cx + r * Math.cos(angle) + (Math.random() - 0.5) * 30,
y: cy + r * Math.sin(angle) + (Math.random() - 0.5) * 30,
fx: null,
fy: null
}
})

// Build all candidate edges
const candidates: GraphEdge[] = []
for (let i = 0; i < n; i++) {
for (let j = i + 1; j < n; j++) {
const a = items[i]
const b = items[j]
const keyA = `${a.mediaType}:${a.id}`
const keyB = `${b.mediaType}:${b.id}`

const sharedGenres = a.genre_ids.filter((g) => b.genre_ids.includes(g))

let sharedKeywords: number[] = []
if (keywordMap) {
const kA = new Set(keywordMap.get(keyA) ?? [])
const kB = keywordMap.get(keyB) ?? []
sharedKeywords = kB.filter((k) => kA.has(k))
}

const weight = sharedGenres.length * GENRE_EDGE_WEIGHT + sharedKeywords.length * KEYWORD_EDGE_WEIGHT
if (weight > 0) {
candidates.push({
source: keyA,
target: keyB,
sharedGenres,
sharedKeywords,
weight
})
}
}
}

// Raise minimum weight threshold automatically to keep graph readable
let minWeight = 1
if (candidates.length > 400) minWeight = 2
if (candidates.length > 900) minWeight = 4

const edges = candidates.filter((e) => e.weight >= minWeight)

return { nodes, edges }
}
