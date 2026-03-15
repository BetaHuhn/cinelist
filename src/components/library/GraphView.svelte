<script lang="ts">
	import { onMount, onDestroy } from 'svelte'
	import { goto } from '$app/navigation'
	import { formatYear } from '$lib/utils/format'
	import { buildGraph, getNodeColor, GENRE_COLORS, GENRE_NAMES, type GraphNode, type GraphEdge } from '$lib/utils/graph'
	import type { WatchlistItem } from '$lib/types/app'

	interface Props {
		items: WatchlistItem[]
	}

	let { items }: Props = $props()

	// ── Container & SVG refs ──────────────────────────────────────────────────
	let containerEl = $state<HTMLDivElement | null>(null)
	let svgEl = $state<SVGSVGElement | null>(null)

	// ── Graph state ───────────────────────────────────────────────────────────
	let nodes = $state<GraphNode[]>([])
	let edges = $state<GraphEdge[]>([])

	// Derived map for O(1) lookup during simulation and interactions
	// We rebuild it whenever `nodes` changes (length or identity).
	let nodeMap = $derived(new Map(nodes.map((n) => [n.id, n])))

	// ── Layout dimensions ─────────────────────────────────────────────────────
	let w = $state(800)
	let h = $state(600)

	// ── Simulation state ──────────────────────────────────────────────────────
	const NODE_RADIUS = 20
	const REPULSION = 3000
	const SPRING_REST = 150
	const SPRING_K = 0.035
	const CENTER_K = 0.004
	const DAMPING = 0.82
	const MAX_TICKS = 280

	let ticksDone = $state(0)
	let animFrame: number | null = null

	function simTick() {
		const cx = w / 2
		const cy = h / 2
		const n = nodes.length

		// Repulsion between every pair of nodes
		for (let i = 0; i < n; i++) {
			for (let j = i + 1; j < n; j++) {
				const a = nodes[i]
				const b = nodes[j]
				let dx = b.x - a.x
				let dy = b.y - a.y
				let d = Math.sqrt(dx * dx + dy * dy)
				if (d < 0.5) {
					dx = Math.random() - 0.5
					dy = Math.random() - 0.5
					d = 0.5
				}
				const f = REPULSION / (d * d)
				const fx = (dx / d) * f
				const fy = (dy / d) * f
				if (!a.pinned) { a.vx -= fx; a.vy -= fy }
				if (!b.pinned) { b.vx += fx; b.vy += fy }
			}
		}

		// Spring attraction along edges
		for (const e of edges) {
			const a = nodeMap.get(e.source)
			const b = nodeMap.get(e.target)
			if (!a || !b) continue
			const dx = b.x - a.x
			const dy = b.y - a.y
			const d = Math.sqrt(dx * dx + dy * dy) || 1
			const f = (d - SPRING_REST) * SPRING_K * e.weight
			const fx = (dx / d) * f
			const fy = (dy / d) * f
			if (!a.pinned) { a.vx += fx; a.vy += fy }
			if (!b.pinned) { b.vx -= fx; b.vy -= fy }
		}

		// Centering + damping + integrate
		for (const node of nodes) {
			if (node.pinned) continue
			node.vx += (cx - node.x) * CENTER_K
			node.vy += (cy - node.y) * CENTER_K
			node.vx *= DAMPING
			node.vy *= DAMPING
			node.x += node.vx
			node.y += node.vy
		}
	}

	function runAnimation() {
		if (ticksDone >= MAX_TICKS) return
		simTick()
		ticksDone++

		// Early exit: stop once all nodes have essentially settled
		const maxV = nodes.reduce((m, n) => Math.max(m, Math.abs(n.vx), Math.abs(n.vy)), 0)
		if (ticksDone > 30 && maxV < 0.05) return

		animFrame = requestAnimationFrame(runAnimation)
	}

	// ── Interaction state ─────────────────────────────────────────────────────
	let hoveredId = $state<string | null>(null)
	let draggingId = $state<string | null>(null)
	let didDrag = $state(false)
	let dragAnchor = $state({ svgX: 0, svgY: 0, nodeX: 0, nodeY: 0 })

	// ── Viewport (pan + zoom) ─────────────────────────────────────────────────
	let panX = $state(0)
	let panY = $state(0)
	let scale = $state(1)

	// Whether we are panning the viewport (dragging empty canvas)
	let panning = $state(false)
	let panAnchor = $state({ clientX: 0, clientY: 0, panX: 0, panY: 0 })

	function clientToSvg(cx: number, cy: number): { x: number; y: number } {
		if (!svgEl) return { x: 0, y: 0 }
		const r = svgEl.getBoundingClientRect()
		return {
			x: (cx - r.left - panX) / scale,
			y: (cy - r.top - panY) / scale
		}
	}

	// ── Node pointer events ───────────────────────────────────────────────────
	function onNodePointerDown(e: PointerEvent, nodeId: string) {
		e.stopPropagation()
		const node = nodeMap.get(nodeId)
		if (!node) return
		node.pinned = true
		node.vx = 0
		node.vy = 0
		draggingId = nodeId
		didDrag = false
		const sp = clientToSvg(e.clientX, e.clientY)
		dragAnchor = { svgX: sp.x, svgY: sp.y, nodeX: node.x, nodeY: node.y }
		;(e.currentTarget as Element).setPointerCapture(e.pointerId)
	}

	function onNodePointerMove(e: PointerEvent) {
		if (!draggingId) return
		const node = nodeMap.get(draggingId)
		if (!node) return
		const sp = clientToSvg(e.clientX, e.clientY)
		const dx = sp.x - dragAnchor.svgX
		const dy = sp.y - dragAnchor.svgY
		if (Math.hypot(dx, dy) > 4) didDrag = true
		if (didDrag) {
			node.x = dragAnchor.nodeX + dx
			node.y = dragAnchor.nodeY + dy
		}
	}

	function onNodePointerUp(e: PointerEvent, nodeId: string) {
		if (draggingId !== nodeId) return
		const node = nodeMap.get(nodeId)
		if (node) {
			node.pinned = false
			node.vx = 0
			node.vy = 0
		}
		if (!didDrag && node) {
			const item = node.item
			void goto(item.mediaType === 'tv' ? `/tv/${item.id}` : `/movie/${item.id}`)
		}
		draggingId = null
		didDrag = false
	}

	// ── Canvas pointer events (pan) ───────────────────────────────────────────
	function onCanvasPointerDown(e: PointerEvent) {
		if (draggingId) return
		panning = true
		panAnchor = { clientX: e.clientX, clientY: e.clientY, panX, panY }
		;(e.currentTarget as Element).setPointerCapture(e.pointerId)
	}

	function onCanvasPointerMove(e: PointerEvent) {
		if (!panning) return
		panX = panAnchor.panX + (e.clientX - panAnchor.clientX)
		panY = panAnchor.panY + (e.clientY - panAnchor.clientY)
	}

	function onCanvasPointerUp() {
		panning = false
	}

	// ── Scroll to zoom ────────────────────────────────────────────────────────
	function onWheel(e: WheelEvent) {
		e.preventDefault()
		const factor = e.deltaY < 0 ? 1.1 : 0.9
		const newScale = Math.min(Math.max(scale * factor, 0.25), 4)

		// Zoom towards the mouse cursor
		if (!svgEl) { scale = newScale; return }
		const r = svgEl.getBoundingClientRect()
		const mx = e.clientX - r.left
		const my = e.clientY - r.top
		panX = mx - (mx - panX) * (newScale / scale)
		panY = my - (my - panY) * (newScale / scale)
		scale = newScale
	}

	// ── Legend state ──────────────────────────────────────────────────────────
	// Collect unique genres present in the current items
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

	// ── Tooltip ───────────────────────────────────────────────────────────────
	const hoveredNode = $derived(hoveredId ? nodeMap.get(hoveredId) : undefined)

	// ── Mount ─────────────────────────────────────────────────────────────────
	onMount(() => {
		if (containerEl) {
			const r = containerEl.getBoundingClientRect()
			w = r.width || 800
			h = r.height || 600
		}
		const { nodes: ns, edges: es } = buildGraph(items, w / 2, h / 2)
		nodes = ns
		edges = es
		animFrame = requestAnimationFrame(runAnimation)
	})

	onDestroy(() => {
		if (animFrame !== null) cancelAnimationFrame(animFrame)
	})
</script>

<div
	bind:this={containerEl}
	class="relative w-full overflow-hidden rounded-2xl"
	style="height: 600px; background: var(--color-surface-900); touch-action: none;"
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
			<g transform="translate({panX},{panY}) scale({scale})">
				<!-- Edges -->
				{#each edges as edge (edge.source + '→' + edge.target)}
					{@const a = nodeMap.get(edge.source)}
					{@const b = nodeMap.get(edge.target)}
					{#if a && b}
						<line
							x1={a.x}
							y1={a.y}
							x2={b.x}
							y2={b.y}
							stroke="rgba(255,255,255,{edge.weight > 1 ? 0.12 : 0.06})"
							stroke-width={edge.weight > 1 ? 1.5 : 0.8}
						/>
					{/if}
				{/each}

				<!-- Nodes -->
				{#each nodes as node (node.id)}
					{@const hovered = hoveredId === node.id}
					{@const color = getNodeColor(node.item)}
					<g
						transform="translate({node.x},{node.y})"
						style="cursor: {draggingId === node.id ? 'grabbing' : 'pointer'};"
						role="button"
						tabindex="0"
						aria-label={node.item.title}
						onpointerdown={(e) => onNodePointerDown(e, node.id)}
						onpointerup={(e) => onNodePointerUp(e, node.id)}
						onpointercancel={(e) => onNodePointerUp(e, node.id)}
						onpointerenter={() => (hoveredId = node.id)}
						onpointerleave={() => { if (hoveredId === node.id) hoveredId = null }}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault()
								const item = node.item
								void goto(item.mediaType === 'tv' ? `/tv/${item.id}` : `/movie/${item.id}`)
							}
						}}
					>
						<!-- Glow ring on hover -->
						{#if hovered}
							<circle
								r={NODE_RADIUS + 6}
								fill="none"
								stroke={color}
								stroke-width="2"
								opacity="0.4"
							/>
						{/if}

						<!-- Main circle -->
						<circle
							r={hovered ? NODE_RADIUS + 2 : NODE_RADIUS}
							fill={color}
							opacity={hovered ? 1 : 0.85}
						/>

						<!-- First letter of title -->
						<text
							text-anchor="middle"
							dominant-baseline="central"
							font-size="13"
							font-weight="700"
							fill="white"
							style="pointer-events: none;"
						>{node.item.title.charAt(0).toUpperCase()}</text>

						<!-- Label below node (always visible) -->
						<text
							y={NODE_RADIUS + 12}
							text-anchor="middle"
							font-size="9"
							fill="rgba(255,255,255,0.65)"
							style="pointer-events: none;"
						>{node.item.title.length > 22 ? node.item.title.slice(0, 20) + '…' : node.item.title}</text>
					</g>
				{/each}
			</g>
		</svg>

		<!-- Tooltip (rendered in DOM overlay, not SVG, so it can overflow) -->
		{#if hoveredNode}
			<div
				class="pointer-events-none absolute left-4 top-4 rounded-xl p-3 text-sm max-w-48 z-10"
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
				<p class="text-[10px] mt-2" style="color: var(--color-ink-500)">Click to open · Drag to move</p>
			</div>
		{/if}

		<!-- Legend -->
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

		<!-- Controls hint -->
		<div
			class="pointer-events-none absolute bottom-3 left-3 rounded-lg px-2 py-1 text-[10px]"
			style="background: color-mix(in srgb, var(--color-surface-800) 80%, transparent); color: var(--color-ink-500);"
		>
			Scroll to zoom · Drag to pan · {edges.length} connection{edges.length === 1 ? '' : 's'}
		</div>
	{/if}
</div>
