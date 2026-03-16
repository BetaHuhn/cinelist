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
 * Edges are scored using Jaccard similarity so that items sharing a large
 * proportion of their genres/keywords are strongly connected while items
 * that merely happen to share one common genre are only weakly (or not)
 * connected.  A greedy per-node edge cap keeps the total number of edges
 * O(n) regardless of library size, making the layout stable for hundreds
 * of items.
 *
 * Edge weight scale (0 – 9):
 *   keyword Jaccard × 6  +  genre Jaccard × 3
 *
 * @param items      Watchlist items to visualise.
 * @param cx         Initial horizontal centre for the layout.
 * @param cy         Initial vertical centre for the layout.
 * @param keywordMap Optional map of "mediaType:id" → keyword ID array.
 */

/** Maximum edges kept per node (greedy, highest-weight first). */
const MAX_EDGES_PER_NODE = 8
/** Minimum combined Jaccard weight to even consider an edge. */
const MIN_EDGE_WEIGHT = 0.5

export function buildGraph(
items: WatchlistItem[],
cx: number,
cy: number,
keywordMap?: Map<string, number[]>
): { nodes: GraphNode[]; edges: GraphEdge[] } {
const n = items.length

// ── Initial layout ────────────────────────────────────────────────────────
// For small graphs use a single ring; for larger ones spread nodes randomly
// across the available area so the simulation starts with less overlap.
const nodes: GraphNode[] = items.map((item, i) => {
let x: number, y: number
if (n <= 40) {
const angle = (i / Math.max(n, 1)) * 2 * Math.PI
const r = 60 + Math.min(n, 24) * 7
x = cx + r * Math.cos(angle) + (Math.random() - 0.5) * 20
y = cy + r * Math.sin(angle) + (Math.random() - 0.5) * 20
} else {
// Random placement scaled to viewport — avoids the dense-circle problem
// that causes chaotic initial movement for large item sets.
const spreadX = cx * 1.4
const spreadY = cy * 1.4
x = cx + (Math.random() - 0.5) * spreadX
y = cy + (Math.random() - 0.5) * spreadY
}
return { id: `${item.mediaType}:${item.id}`, item, x, y, fx: null, fy: null }
})

// ── Build candidate edges with Jaccard similarity ─────────────────────────
const candidates: GraphEdge[] = []
for (let i = 0; i < n; i++) {
for (let j = i + 1; j < n; j++) {
const a = items[i]
const b = items[j]
const keyA = `${a.mediaType}:${a.id}`
const keyB = `${b.mediaType}:${b.id}`

// Genre Jaccard: |A∩B| / |A∪B|
const genreSetB = new Set(b.genre_ids)
const sharedGenres = a.genre_ids.filter((g) => genreSetB.has(g))
const genreUnion = new Set([...a.genre_ids, ...b.genre_ids]).size
const genreJaccard = genreUnion > 0 ? sharedGenres.length / genreUnion : 0

// Keyword Jaccard: |A∩B| / |A∪B|
let sharedKeywords: number[] = []
let kwJaccard = 0
if (keywordMap) {
const kA = keywordMap.get(keyA) ?? []
const kB = keywordMap.get(keyB) ?? []
if (kA.length > 0 || kB.length > 0) {
const kwSetA = new Set(kA)
sharedKeywords = kB.filter((k) => kwSetA.has(k))
const kwUnion = new Set([...kA, ...kB]).size
kwJaccard = kwUnion > 0 ? sharedKeywords.length / kwUnion : 0
}
}

// Combined weight — keyword overlap is the strongest clustering signal.
const weight = kwJaccard * 6 + genreJaccard * 3
if (weight < MIN_EDGE_WEIGHT) continue

candidates.push({ source: keyA, target: keyB, sharedGenres, sharedKeywords, weight })
}
}

// ── Greedy per-node edge cap (highest weight first) ───────────────────────
// Limits total edges to O(n) so the simulation stays manageable for large
// libraries while still preserving the most meaningful connections.
candidates.sort((a, b) => b.weight - a.weight)

const nodeEdgeCount = new Map<string, number>()
const edges: GraphEdge[] = []
for (const e of candidates) {
const s = e.source as string
const t = e.target as string
const sc = nodeEdgeCount.get(s) ?? 0
const tc = nodeEdgeCount.get(t) ?? 0
if (sc >= MAX_EDGES_PER_NODE && tc >= MAX_EDGES_PER_NODE) continue
edges.push(e)
nodeEdgeCount.set(s, sc + 1)
nodeEdgeCount.set(t, tc + 1)
}

return { nodes, edges }
}
