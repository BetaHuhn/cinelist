<script lang="ts">
import { onMount, onDestroy } from 'svelte'
import {
forceSimulation,
forceManyBody,
forceLink,
forceCenter,
forceCollide
} from 'd3-force'
import { formatYear } from '$lib/utils/format'
import { posterUrl } from '$lib/utils/image'
import {
buildGraph,
getNodeColor,
GENRE_COLORS,
GENRE_NAMES,
type GraphNode,
type GraphEdge
} from '$lib/utils/graph'
import type { WatchlistItem } from '$lib/types/app'
import DetailPreviewModal from '$components/modals/DetailPreviewModal.svelte'

interface Props {
items: WatchlistItem[]
onNodeClick?: (item: WatchlistItem) => void
}

let { items, onNodeClick }: Props = $props()

// ── Container & SVG refs ──────────────────────────────────────────────────
let containerEl = $state<HTMLDivElement | null>(null)
let svgEl = $state<SVGSVGElement | null>(null)

// ── Layout dimensions ─────────────────────────────────────────────────────
let w = $state(800)
let h = $state(600)

// ── d3 simulation data (non-reactive; d3 mutates in-place) ────────────────
/** Raw d3 simulation nodes — d3 mutates x/y/vx/vy here each tick. */
let _simNodes: GraphNode[] = []

// ── Reactive render state ─────────────────────────────────────────────────
/**
 * Snapshot of node positions, updated every simulation tick.
 * Assigning a new Map triggers Svelte reactivity so the SVG re-paints.
 */
let nodePositions = $state<Map<string, { x: number; y: number }>>(new Map())
/**
 * Reactive list of graph nodes (metadata only; positions come from nodePositions).
 * Reassigned when buildSimulation() runs.
 */
let displayNodes = $state<GraphNode[]>([])
/**
 * Reactive list of graph edges.
 * Reassigned when buildSimulation() runs.
 */
let displayEdges = $state<GraphEdge[]>([])
let edgeCount = $state(0)

let simulation: ReturnType<typeof forceSimulation<GraphNode>> | null = null

// ── Keyword loading ───────────────────────────────────────────────────────
let keywordsLoaded = $state(false)
let keywordMap = $state<Map<string, number[]>>(new Map())
let _keywordAbort: AbortController | null = null

// ── Fullscreen state ──────────────────────────────────────────────────────
let fullscreen = $state(false)

// ── Interaction state ─────────────────────────────────────────────────────
let hoveredId = $state<string | null>(null)
let draggingId = $state<string | null>(null)
let didDrag = $state(false)
let dragAnchor = $state({ svgX: 0, svgY: 0, nodeX: 0, nodeY: 0 })

// ── Viewport (pan + zoom) ─────────────────────────────────────────────────
let panX = $state(0)
let panY = $state(0)
let scale = $state(1)
let panning = $state(false)
let panAnchor = $state({ clientX: 0, clientY: 0, panX: 0, panY: 0 })

// ── Pinch-to-zoom tracking (non-reactive – mutated only in event handlers) ─
let _canvasPointers = new Map<number, { x: number; y: number }>()
let _isPinching = false
let _pinchStartDist = 0
let _pinchStartScale = 1
let _pinchStartPanX = 0
let _pinchStartPanY = 0
let _pinchMidSvgX = 0
let _pinchMidSvgY = 0

// ── Constants ─────────────────────────────────────────────────────────────
const NODE_RADIUS = 24
const BORDER_WIDTH = 3

// Zoom limits and step factors
const MIN_SCALE = 0.15
const MAX_SCALE = 5
const ZOOM_IN_FACTOR = 1.25
const ZOOM_OUT_FACTOR = 0.8

// Simulation tuning constants
/** Repulsion is ignored beyond this pixel distance, capping worst-case cost for large graphs. */
const SIM_CHARGE_DISTANCE_MAX = 400
/** Base link distance (px). Heavier Jaccard-weighted edges pull nodes closer. */
const SIM_LINK_DISTANCE_BASE = 160
/** Each unit of edge weight reduces link distance by this many pixels. */
const SIM_LINK_DISTANCE_PER_WEIGHT = 12
/** Maximum reduction in link distance from weight. */
const SIM_LINK_DISTANCE_MAX_REDUCTION = 80
/** Spring strength per unit of edge weight. */
const SIM_LINK_STRENGTH_PER_WEIGHT = 0.06
/** Upper cap for spring strength. */
const SIM_LINK_STRENGTH_MAX = 0.5

// ── Derived map for O(1) lookup by hover/drag ─────────────────────────────
const nodeById = $derived(new Map(displayNodes.map((n) => [n.id, n])))

// ── Tooltip ───────────────────────────────────────────────────────────────
const hoveredNode = $derived(hoveredId ? nodeById.get(hoveredId) : undefined)

// ── Legend ────────────────────────────────────────────────────────────────
const legendGenres = $derived.by(() => {
const seen = new Map<number, string>()
for (const item of items) {
for (const g of item.genre_ids) {
if (!seen.has(g) && GENRE_NAMES[g] && GENRE_COLORS[g]) {
seen.set(g, GENRE_NAMES[g])
}
}
}
return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]))
})

// ── Coordinate helpers ────────────────────────────────────────────────────
function clientToSvg(cx: number, cy: number): { x: number; y: number } {
if (!svgEl) return { x: 0, y: 0 }
const r = svgEl.getBoundingClientRect()
return {
x: (cx - r.left - panX) / scale,
y: (cy - r.top - panY) / scale
}
}

// ── Build / rebuild simulation ────────────────────────────────────────────
function buildSimulation(kwMap?: Map<string, number[]>) {
if (simulation) simulation.stop()

const { nodes, edges } = buildGraph(items, w / 2, h / 2, kwMap)
_simNodes = nodes
displayNodes = [...nodes]
displayEdges = edges
edgeCount = edges.length

// Snapshot initial positions.
nodePositions = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }]))

// Scale charge strength and cooling speed by node count to keep the
// simulation stable for large libraries.
const n = nodes.length
const chargeStrength = n > 100 ? -300 : n > 50 ? -500 : -800
const alphaDecay = n > 100 ? 0.04 : n > 50 ? 0.03 : 0.025
const centerStrength = n > 100 ? 0.1 : 0.05

simulation = forceSimulation<GraphNode>(_simNodes)
.force(
'charge',
forceManyBody<GraphNode>().strength(chargeStrength).distanceMax(SIM_CHARGE_DISTANCE_MAX)
)
.force(
'link',
forceLink<GraphNode, GraphEdge>(edges)
.id((d) => d.id)
.distance((e) => SIM_LINK_DISTANCE_BASE - Math.min(e.weight * SIM_LINK_DISTANCE_PER_WEIGHT, SIM_LINK_DISTANCE_MAX_REDUCTION))
.strength((e) => Math.min(e.weight * SIM_LINK_STRENGTH_PER_WEIGHT, SIM_LINK_STRENGTH_MAX))
)
.force('center', forceCenter<GraphNode>(w / 2, h / 2).strength(centerStrength))
.force('collide', forceCollide<GraphNode>(NODE_RADIUS + BORDER_WIDTH + 6))
.alphaDecay(alphaDecay)
.on('tick', () => {
// Snapshot positions into a new Map to trigger Svelte reactivity.
nodePositions = new Map(_simNodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]))
})
}

// ── Fetch keywords, then rebuild with keyword edges ────────────────────────
async function loadKeywords() {
if (items.length === 0) return
// Cancel any in-progress fetch for a previous item set.
_keywordAbort?.abort()
_keywordAbort = new AbortController()
const signal = _keywordAbort.signal

const ids = items.map((i) => `${i.mediaType}:${i.id}`).join(',')
try {
const res = await fetch(`/api/graph/keywords?items=${encodeURIComponent(ids)}`, { signal })
if (!res.ok || signal.aborted) return
const data = (await res.json()) as Record<string, number[]>
if (signal.aborted) return
keywordMap = new Map(Object.entries(data))
} catch {
// AbortError or network failure — keywords are optional.
if (signal.aborted) return
}
keywordsLoaded = true
buildSimulation(keywordMap)
}

// ── Node pointer events ───────────────────────────────────────────────────
function onNodePointerDown(e: PointerEvent, nodeId: string) {
e.stopPropagation()
const node = _simNodes.find((n) => n.id === nodeId)
if (!node) return
// Pin the node during drag (d3 uses fx/fy for fixed positions).
const pos = nodePositions.get(nodeId)
node.fx = pos?.x ?? node.x ?? 0
node.fy = pos?.y ?? node.y ?? 0
draggingId = nodeId
didDrag = false
const sp = clientToSvg(e.clientX, e.clientY)
dragAnchor = {
svgX: sp.x,
svgY: sp.y,
nodeX: node.fx ?? 0,
nodeY: node.fy ?? 0
}
;(e.currentTarget as Element).setPointerCapture(e.pointerId)
simulation?.alphaTarget(0.3).restart()
}

function onNodePointerMove(e: PointerEvent) {
if (!draggingId) return
const node = _simNodes.find((n) => n.id === draggingId)
if (!node) return
const sp = clientToSvg(e.clientX, e.clientY)
const dx = sp.x - dragAnchor.svgX
const dy = sp.y - dragAnchor.svgY
if (Math.hypot(dx, dy) > 4) didDrag = true
if (didDrag) {
node.fx = dragAnchor.nodeX + dx
node.fy = dragAnchor.nodeY + dy
}
}

function onNodePointerUp(e: PointerEvent, nodeId: string) {
if (draggingId !== nodeId) return
const node = _simNodes.find((n) => n.id === nodeId)
if (node) {
node.fx = null
node.fy = null
}
simulation?.alphaTarget(0)
if (!didDrag && node) {
const item = node.item
if (onNodeClick) {
onNodeClick(item)
} else {
// Fallback: navigate to detail page if no handler provided.
import('$app/navigation').then(({ goto }) => {
void goto(item.mediaType === 'tv' ? `/tv/${item.id}` : `/movie/${item.id}`)
})
}
}
draggingId = null
didDrag = false
}

// ── Canvas pointer events (pan) ───────────────────────────────────────────
function onCanvasPointerDown(e: PointerEvent) {
if (draggingId) return
;(e.currentTarget as Element).setPointerCapture(e.pointerId)
_canvasPointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

if (_canvasPointers.size >= 2) {
// Two fingers on canvas – start pinch-to-zoom
const pts = Array.from(_canvasPointers.values())
_pinchStartDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
_pinchStartScale = scale
_pinchStartPanX = panX
_pinchStartPanY = panY
if (svgEl) {
const r = svgEl.getBoundingClientRect()
_pinchMidSvgX = (pts[0].x + pts[1].x) / 2 - r.left
_pinchMidSvgY = (pts[0].y + pts[1].y) / 2 - r.top
}
_isPinching = true
panning = false
} else {
_isPinching = false
panning = true
panAnchor = { clientX: e.clientX, clientY: e.clientY, panX, panY }
}
}

function onCanvasPointerMove(e: PointerEvent) {
if (_canvasPointers.has(e.pointerId)) {
_canvasPointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
}
if (_isPinching) {
const pts = Array.from(_canvasPointers.values())
if (pts.length >= 2 && _pinchStartDist > 0) {
const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
const newScale = Math.min(Math.max(_pinchStartScale * (dist / _pinchStartDist), MIN_SCALE), MAX_SCALE)
panX = _pinchMidSvgX - (_pinchMidSvgX - _pinchStartPanX) * (newScale / _pinchStartScale)
panY = _pinchMidSvgY - (_pinchMidSvgY - _pinchStartPanY) * (newScale / _pinchStartScale)
scale = newScale
}
return
}
if (!panning) return
panX = panAnchor.panX + (e.clientX - panAnchor.clientX)
panY = panAnchor.panY + (e.clientY - panAnchor.clientY)
}

function onCanvasPointerUp(e: PointerEvent) {
_canvasPointers.delete(e.pointerId)
if (_canvasPointers.size < 2) {
_isPinching = false
}
if (_canvasPointers.size === 0) {
panning = false
} else if (_canvasPointers.size === 1) {
// One finger remaining after pinch – restart single-finger pan
const [, pos] = Array.from(_canvasPointers.entries())[0]
panning = true
panAnchor = { clientX: pos.x, clientY: pos.y, panX, panY }
}
}

// ── Zoom control helpers ──────────────────────────────────────────────────
function zoomBy(factor: number) {
if (!svgEl) { scale = Math.min(Math.max(scale * factor, MIN_SCALE), MAX_SCALE); return }
const r = svgEl.getBoundingClientRect()
const mx = r.width / 2
const my = r.height / 2
const newScale = Math.min(Math.max(scale * factor, MIN_SCALE), MAX_SCALE)
panX = mx - (mx - panX) * (newScale / scale)
panY = my - (my - panY) * (newScale / scale)
scale = newScale
}

function resetView() {
panX = 0
panY = 0
scale = 1
}

// ── Scroll to zoom ────────────────────────────────────────────────────────
function onWheel(e: WheelEvent) {
e.preventDefault()
const factor = e.deltaY < 0 ? 1.1 : 0.9
const newScale = Math.min(Math.max(scale * factor, MIN_SCALE), MAX_SCALE)
if (!svgEl) { scale = newScale; return }
const r = svgEl.getBoundingClientRect()
const mx = e.clientX - r.left
const my = e.clientY - r.top
panX = mx - (mx - panX) * (newScale / scale)
panY = my - (my - panY) * (newScale / scale)
scale = newScale
}

// ── Fullscreen helpers ────────────────────────────────────────────────────
function toggleFullscreen() {
if (!containerEl) return
if (!document.fullscreenElement) {
void containerEl.requestFullscreen()
} else {
void document.exitFullscreen()
}
}

function onFullscreenChange() {
fullscreen = !!document.fullscreenElement
// Re-measure after the browser has resized the element.
requestAnimationFrame(() => {
if (!containerEl) return
const r = containerEl.getBoundingClientRect()
w = r.width || 800
h = r.height || 600
// Shift the centre force so nodes gravitate to the new centre.
simulation
?.force('center', forceCenter<GraphNode>(w / 2, h / 2))
?.alpha(0.3)
.restart()
})
}

// ── Mount & reactivity ────────────────────────────────────────────────────
// Track whether the first effect run has been handled by onMount so we don't
// double-build.
let _afterFirstMount = false

onMount(() => {
if (containerEl) {
const r = containerEl.getBoundingClientRect()
w = r.width || 800
h = r.height || 600
}
document.addEventListener('fullscreenchange', onFullscreenChange)
_afterFirstMount = true
buildSimulation()
void loadKeywords()
})

// Rebuild the graph whenever the items list changes (e.g. the user switches
// library tabs).  The flag guards against running before onMount has set up
// the container dimensions.
$effect(() => {
const _items = items // reactive dependency — re-runs when items changes
if (!_afterFirstMount) return

// Reset viewport and keyword state for the new item set.
simulation?.stop()
keywordsLoaded = false
keywordMap = new Map()
panX = 0
panY = 0
scale = 1
_canvasPointers = new Map()
_isPinching = false
panning = false

buildSimulation()
void loadKeywords()
})

onDestroy(() => {
simulation?.stop()
_keywordAbort?.abort()
document.removeEventListener('fullscreenchange', onFullscreenChange)
})
</script>

<div
bind:this={containerEl}
class="relative w-full overflow-hidden {fullscreen ? '' : 'rounded-2xl'}"
style="height: {fullscreen ? '100vh' : '600px'}; background: var(--color-surface-900); touch-action: none;"
>
{#if items.length === 0}
<div class="flex items-center justify-center h-full">
<p style="color: var(--color-ink-500)">Add items to your library to see the graph.</p>
</div>
{:else}
<!-- SVG canvas -->
<svg
bind:this={svgEl}
role="application"
aria-label="Movie connection graph – scroll to zoom, drag to pan, click a node to open"
class="w-full h-full"
style="cursor: {panning ? 'grabbing' : 'grab'}; user-select: none;"
onpointerdown={onCanvasPointerDown}
onpointermove={(e) => { onCanvasPointerMove(e); onNodePointerMove(e) }}
onpointerup={onCanvasPointerUp}
onpointercancel={onCanvasPointerUp}
onwheel={onWheel}
>
<defs>
<!-- One shared clip-path for all poster circles -->
<clipPath id="node-poster-clip">
<circle r={NODE_RADIUS} cx="0" cy="0" />
</clipPath>
</defs>

<g transform="translate({panX},{panY}) scale({scale})">
<!-- Edges – rendered first so nodes appear on top -->
{#each displayEdges as edge, i (i)}
{@const src = typeof edge.source === 'object' ? (edge.source as GraphNode).id : (edge.source as string)}
{@const tgt = typeof edge.target === 'object' ? (edge.target as GraphNode).id : (edge.target as string)}
{@const aPos = nodePositions.get(src)}
{@const bPos = nodePositions.get(tgt)}
{#if aPos && bPos}
{@const hasKw = edge.sharedKeywords.length > 0}
<line
x1={aPos.x}
y1={aPos.y}
x2={bPos.x}
y2={bPos.y}
stroke={hasKw
? `rgba(167,139,250,${edge.weight > 4 ? 0.35 : 0.16})`
: `rgba(255,255,255,${edge.weight > 4 ? 0.18 : 0.08})`}
stroke-width={edge.weight > 4 ? 2 : edge.weight > 1.5 ? 1.2 : 0.7}
/>
{/if}
{/each}

<!-- Nodes -->
{#each displayNodes as node (node.id)}
{@const pos = nodePositions.get(node.id)}
{@const hovered = hoveredId === node.id}
{@const color = getNodeColor(node.item)}
{#if pos}
<g
transform="translate({pos.x},{pos.y})"
style="cursor: {draggingId === node.id ? 'grabbing' : 'pointer'}; outline: none;"
role="button"
tabindex="0"
aria-label={node.item.title}
onpointerdown={(e) => onNodePointerDown(e, node.id)}
onpointerup={(e) => onNodePointerUp(e, node.id)}
onpointercancel={(e) => onNodePointerUp(e, node.id)}
onpointerenter={() => (hoveredId = node.id)}
onpointerleave={() => { if (hoveredId === node.id) hoveredId = null }}
onfocus={() => (hoveredId = node.id)}
onblur={() => { if (hoveredId === node.id) hoveredId = null }}
onkeydown={(e) => {
if (e.key === 'Enter' || e.key === ' ') {
e.preventDefault()
const item = node.item
if (onNodeClick) {
onNodeClick(item)
} else {
import('$app/navigation').then(({ goto }) => {
void goto(item.mediaType === 'tv' ? `/tv/${item.id}` : `/movie/${item.id}`)
})
}
}
}}
>
<!-- Hover glow -->
{#if hovered}
<circle
r={NODE_RADIUS + BORDER_WIDTH + 6}
fill="none"
stroke={color}
stroke-width="2"
opacity="0.35"
/>
{/if}

<!-- Genre-colored border ring -->
<circle
r={NODE_RADIUS + BORDER_WIDTH}
fill={color}
opacity={hovered ? 1 : 0.9}
/>

<!-- Poster image (clipped to inner circle) -->
{#if node.item.poster_path}
<image
href={posterUrl(node.item.poster_path, 'w185')}
x={-NODE_RADIUS}
y={-NODE_RADIUS}
width={NODE_RADIUS * 2}
height={NODE_RADIUS * 2}
clip-path="url(#node-poster-clip)"
preserveAspectRatio="xMidYMid slice"
style="pointer-events: none;"
/>
{:else}
<!-- Coloured fallback when no poster -->
<circle r={NODE_RADIUS} fill={color} opacity="0.7" />
<text
text-anchor="middle"
dominant-baseline="central"
font-size="14"
font-weight="700"
fill="white"
style="pointer-events: none;"
>{node.item.title.charAt(0).toUpperCase()}</text>
{/if}

<!-- Title label below the node -->
<text
y={NODE_RADIUS + BORDER_WIDTH + 11}
text-anchor="middle"
font-size="9"
fill="rgba(255,255,255,{hovered ? 0.9 : 0.6})"
style="pointer-events: none;"
>{node.item.title.length > 22 ? node.item.title.slice(0, 20) + '…' : node.item.title}</text>
</g>
{/if}
{/each}
</g>
</svg>

<!-- Tooltip (DOM overlay so it can overflow the SVG) -->
{#if hoveredNode}
<div
class="pointer-events-none absolute left-4 top-4 rounded-xl p-3 text-sm max-w-52 z-10"
style="background: var(--color-surface-700); border: 1px solid var(--color-surface-500);"
>
<p class="font-semibold truncate" style="color: var(--color-ink-100)">
{hoveredNode.item.title}
</p>
{#if hoveredNode.item.release_date}
<p class="text-xs mt-0.5" style="color: var(--color-ink-500)">
{formatYear(hoveredNode.item.release_date)}
{#if hoveredNode.item.vote_average > 0}
· ★ {hoveredNode.item.vote_average.toFixed(1)}
{/if}
</p>
{/if}
{#if hoveredNode.item.genre_ids.length > 0}
<div class="flex flex-wrap gap-1 mt-1.5">
{#each hoveredNode.item.genre_ids.slice(0, 3) as gid (gid)}
{#if GENRE_NAMES[gid]}
<span
class="px-1.5 py-0.5 rounded text-[10px] font-medium"
style="background: {GENRE_COLORS[gid] ?? 'var(--color-surface-500)'}22; color: {GENRE_COLORS[gid] ?? 'var(--color-ink-300)'};"
>{GENRE_NAMES[gid]}</span>
{/if}
{/each}
</div>
{/if}
{#if (keywordMap.get(`${hoveredNode.item.mediaType}:${hoveredNode.item.id}`) ?? []).length > 0}
{@const kwCount = (keywordMap.get(`${hoveredNode.item.mediaType}:${hoveredNode.item.id}`) ?? []).length}
<p class="text-[10px] mt-1" style="color: var(--color-ink-500)">{kwCount} keyword{kwCount === 1 ? '' : 's'}</p>
{/if}
<p class="text-[10px] mt-2" style="color: var(--color-ink-500)">Click to open · Drag to move</p>
</div>
{/if}

<!-- Genre legend -->
{#if legendGenres.length > 0}
<div
class="pointer-events-none absolute bottom-3 right-3 rounded-xl p-3 max-w-44 z-10"
style="background: color-mix(in srgb, var(--color-surface-800) 90%, transparent); border: 1px solid var(--color-surface-600);"
>
<p class="text-[10px] font-semibold mb-2" style="color: var(--color-ink-300)">GENRES</p>
<div class="flex flex-col gap-1">
{#each legendGenres.slice(0, 10) as [gid, name] (gid)}
<div class="flex items-center gap-1.5">
<span
class="inline-block size-2 rounded-full shrink-0"
style="background: {GENRE_COLORS[gid]};"
></span>
<span class="text-[10px] truncate" style="color: var(--color-ink-300)">{name}</span>
</div>
{/each}
{#if legendGenres.length > 10}
<p class="text-[10px] mt-0.5" style="color: var(--color-ink-500)">+{legendGenres.length - 10} more</p>
{/if}
</div>
</div>
{/if}

<!-- Controls / status hint -->
<div
class="pointer-events-none absolute bottom-3 left-3 rounded-lg px-2 py-1 text-[10px]"
style="background: color-mix(in srgb, var(--color-surface-800) 80%, transparent); color: var(--color-ink-500);"
>
{#if !keywordsLoaded}
Loading keyword connections…
{:else}
Pinch or scroll to zoom · Drag to pan · {edgeCount} connection{edgeCount === 1 ? '' : 's'}
{/if}
</div>

<!-- Top-right controls: fullscreen + zoom buttons -->
<div class="absolute top-3 right-3 z-10 flex flex-col gap-1">
<!-- Expand / collapse button -->
<button
class="rounded-lg p-1.5 transition-opacity"
style="background: color-mix(in srgb, var(--color-surface-800) 80%, transparent); color: var(--color-ink-300); opacity: 0.8;"
onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.8')}
onclick={toggleFullscreen}
title={fullscreen ? 'Exit fullscreen' : 'Expand fullscreen'}
aria-label={fullscreen ? 'Exit fullscreen' : 'Expand fullscreen'}
>
{#if fullscreen}
<!-- Compress icon -->
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
<path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
</svg>
{:else}
<!-- Expand icon -->
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
<path d="M15 3h6v6"/><path d="M9 21H3v-6"/>
<path d="M21 3l-7 7"/><path d="M3 21l7-7"/>
</svg>
{/if}
</button>
<!-- Zoom in -->
<button
class="rounded-lg p-1.5 transition-opacity"
style="background: color-mix(in srgb, var(--color-surface-800) 80%, transparent); color: var(--color-ink-300); opacity: 0.8;"
onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.8')}
onclick={() => zoomBy(ZOOM_IN_FACTOR)}
title="Zoom in"
aria-label="Zoom in"
>
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
<line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
</svg>
</button>
<!-- Zoom out -->
<button
class="rounded-lg p-1.5 transition-opacity"
style="background: color-mix(in srgb, var(--color-surface-800) 80%, transparent); color: var(--color-ink-300); opacity: 0.8;"
onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.8')}
onclick={() => zoomBy(ZOOM_OUT_FACTOR)}
title="Zoom out"
aria-label="Zoom out"
>
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
<line x1="8" y1="11" x2="14" y2="11"/>
</svg>
</button>
<!-- Reset view -->
<button
class="rounded-lg p-1.5 transition-opacity"
style="background: color-mix(in srgb, var(--color-surface-800) 80%, transparent); color: var(--color-ink-300); opacity: 0.8;"
onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.8')}
onclick={resetView}
title="Reset view"
aria-label="Reset view"
>
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
</svg>
</button>
</div>
{/if}

<!-- Fullscreen preview: render DetailPreviewModal inside the container so it
     appears on top of the graph when the browser's Fullscreen API is active.
     Outside fullscreen the modal in +layout.svelte handles this instead. -->
{#if fullscreen}
<DetailPreviewModal />
{/if}
</div>
