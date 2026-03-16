<script lang="ts">
	import type { TMDBMediaResult } from '$lib/types/tmdb'
	import { posterUrl } from '$lib/utils/image'
	import { formatYear } from '$lib/utils/format'

	interface Props {
		item: TMDBMediaResult
		onlike: () => void
		ondislike: () => void
		/** Whether this is the top (active) card */
		active?: boolean
		/** Stack position index (0 = top, 1 = second, …) */
		stackIndex?: number
		/** When set by parent, animate out in this direction then call handler */
		forcedSwipe?: 'left' | 'right' | null
	}

	let { item, onlike, ondislike, active = false, stackIndex = 0, forcedSwipe = null }: Props = $props()

	const title = $derived('title' in item ? item.title : item.name)
	const date = $derived('release_date' in item ? item.release_date : item.first_air_date)

	// Drag state
	let dragging = $state(false)
	let startX = $state(0)
	let startY = $state(0)
	let dx = $state(0)
	let dy = $state(0)
	let swiping = $state<'left' | 'right' | null>(null)
	let imageLoaded = $state(false)

	const SWIPE_THRESHOLD = 100
	const ROTATE_FACTOR = 0.08

	const rotate = $derived(active ? dx * ROTATE_FACTOR : 0)
	const translateX = $derived(active ? dx : 0)
	const translateY = $derived(active ? dy * 0.3 : 0)

	const overlayOpacity = $derived(
		active ? Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1) : 0
	)
	const showLike = $derived(dx > 20)
	const showDislike = $derived(dx < -20)

	// Stack visual transforms for background cards
	const stackScale = $derived(active ? 1 : 1 - stackIndex * 0.04)
	const stackY = $derived(active ? 0 : stackIndex * 12)

	function onPointerDown(e: PointerEvent) {
		if (!active) return
		const target = e.target as HTMLElement
		if (target.closest('button, a, [role="button"]')) return
		dragging = true
		startX = e.clientX
		startY = e.clientY
		dx = 0
		dy = 0
		;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging || !active) return
		dx = e.clientX - startX
		dy = e.clientY - startY
	}

	function onPointerUp(_e: PointerEvent) {
		if (!dragging || !active) return
		dragging = false

		if (dx > SWIPE_THRESHOLD) {
			swiping = 'right'
			setTimeout(() => {
				swiping = null
				dx = 0
				dy = 0
				onlike()
			}, 350)
		} else if (dx < -SWIPE_THRESHOLD) {
			swiping = 'left'
			setTimeout(() => {
				swiping = null
				dx = 0
				dy = 0
				ondislike()
			}, 350)
		} else {
			// Snap back
			dx = 0
			dy = 0
		}
	}

	/** Called by parent buttons */
	export function triggerLike() {
		if (!active) return
		swiping = 'right'
		dx = 300
		setTimeout(() => {
			swiping = null
			dx = 0
			dy = 0
			onlike()
		}, 350)
	}

	export function triggerDislike() {
		if (!active) return
		swiping = 'left'
		dx = -300
		setTimeout(() => {
			swiping = null
			dx = 0
			dy = 0
			ondislike()
		}, 350)
	}

	// React to forcedSwipe prop from parent
	$effect(() => {
		if (!active || !forcedSwipe) return
		if (forcedSwipe === 'right') triggerLike()
		else triggerDislike()
	})

	const flyX = $derived(
		swiping === 'right' ? 'translateX(150%) rotate(20deg)' :
		swiping === 'left' ? 'translateX(-150%) rotate(-20deg)' :
		dragging
			? `translateX(${translateX}px) translateY(${translateY}px) rotate(${rotate}deg)`
			: `translateX(0) translateY(${stackY}px) scale(${stackScale})`
	)

	const transitionStyle = $derived(
		swiping !== null ? 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)' :
		dragging ? 'none' :
		'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
	)
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="swipe-card absolute inset-0 rounded-2xl overflow-hidden select-none touch-none"
	style:transform={flyX}
	style:transition={transitionStyle}
	style:cursor={active ? (dragging ? 'grabbing' : 'grab') : 'default'}
	style:z-index={10 - stackIndex}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={onPointerUp}
>
	<!-- Background poster -->
	<div class="absolute inset-0" style="background: var(--color-surface-800)">
		{#if !imageLoaded}
			<div class="skeleton absolute inset-0 rounded-none"></div>
		{/if}
		<img
			src={posterUrl(item.poster_path, 'w500')}
			alt={title}
			class="w-full h-full object-cover"
			class:opacity-0={!imageLoaded}
			onload={() => (imageLoaded = true)}
			draggable="false"
		/>
	</div>

	<!-- Like overlay (green) -->
	{#if active}
		<div
			class="absolute inset-0 flex items-center justify-center pointer-events-none"
			style:background="rgba(74, 222, 128, 0.35)"
			style:opacity={showLike ? overlayOpacity : 0}
			style:transition={dragging ? 'none' : 'opacity 0.2s'}
		>
			<div class="border-4 border-green-400 rounded-xl px-6 py-3 -rotate-12">
				<span class="text-green-400 text-4xl font-black tracking-widest">ADD</span>
			</div>
		</div>

		<!-- Dislike overlay (red) -->
		<div
			class="absolute inset-0 flex items-center justify-center pointer-events-none"
			style:background="rgba(248, 113, 113, 0.35)"
			style:opacity={showDislike ? overlayOpacity : 0}
			style:transition={dragging ? 'none' : 'opacity 0.2s'}
		>
			<div class="border-4 border-red-400 rounded-xl px-6 py-3 rotate-12">
				<span class="text-red-400 text-4xl font-black tracking-widest">SKIP</span>
			</div>
		</div>
	{/if}

	<!-- Gradient overlay + metadata -->
	<div
		class="absolute inset-0 flex flex-col justify-end pointer-events-none"
		style="background: linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)"
	>
		<div class="p-5 pb-6">
			<!-- Rating badge -->
			{#if item.vote_average > 0}
				<span class="inline-block text-xs font-bold px-2 py-0.5 rounded-lg mb-2"
					style="background: rgba(0,0,0,0.6); color: var(--color-amber-500)">
					★ {item.vote_average.toFixed(1)}
				</span>
			{/if}
			<h2 class="text-2xl font-bold leading-tight text-white mb-1">{title}</h2>
			<p class="text-sm text-gray-300">{formatYear(date)} · {item.media_type === 'tv' ? 'TV Show' : 'Movie'}</p>
			{#if item.overview}
				<p class="text-sm text-gray-300 mt-2 line-clamp-3 leading-relaxed">{item.overview}</p>
			{/if}
		</div>
	</div>
</div>
