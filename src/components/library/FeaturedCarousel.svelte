<script lang="ts">
	import { backdropUrl, posterUrl } from '$lib/utils/image'
	import { formatYear } from '$lib/utils/format'
	import type { FeaturedItem } from '$lib/types/featured'
	import { openDetailPreview } from '$lib/utils/preview'
	import { page } from '$app/state'
	import { openContextMenu } from '$lib/stores/contextMenu'

	interface Props {
		items: FeaturedItem[]
	}

	let { items }: Props = $props()

	const HOLD_MS = 450
	const MOVE_PX = 10
	let pressTimer: ReturnType<typeof setTimeout> | null = $state(null)
	let startX = $state(0)
	let startY = $state(0)
	let suppressClick = $state(false)
	let pendingPreview: { mediaType: 'movie' | 'tv'; id: number } | null = $state(null)

	function fromPath(): string {
		return (page.state as App.PageState | undefined)?.preview?.from
			?? `${page.url.pathname}${page.url.search}${page.url.hash}`
	}

	function openPreview(mediaType: 'movie' | 'tv', id: number) {
		suppressClick = true
		openDetailPreview({ mediaType, id, fromUrl: page.url, fromOverride: fromPath() })
	}

	function isInteractiveTarget(target: EventTarget | null): boolean {
		const el = target as HTMLElement | null
		return !!el?.closest('button, input, textarea, select, [role="button"], [data-no-preview]')
	}

	function abortHold() {
		if (pressTimer) {
			clearTimeout(pressTimer)
			pressTimer = null
		}
	}

	function startHold(e: PointerEvent, mediaType: 'movie' | 'tv', id: number) {
		if (isInteractiveTarget(e.target)) return
		if (e.button !== 0) return
		abortHold()
		pendingPreview = { mediaType, id }
		startX = e.clientX
		startY = e.clientY
		pressTimer = setTimeout(() => {
			pressTimer = null
			if (!pendingPreview) return
			openPreview(pendingPreview.mediaType, pendingPreview.id)
		}, HOLD_MS)
	}

	function moveHold(e: PointerEvent) {
		if (!pressTimer) return
		const dx = e.clientX - startX
		const dy = e.clientY - startY
		if (Math.hypot(dx, dy) > MOVE_PX) abortHold()
	}

	function endHold() {
		abortHold()
		pendingPreview = null
	}

	function handleClick(e: MouseEvent, mediaType: 'movie' | 'tv', id: number) {
		if (suppressClick) {
			e.preventDefault()
			e.stopPropagation()
			suppressClick = false
			return
		}
		if (e.shiftKey && !isInteractiveTarget(e.target)) {
			e.preventDefault()
			e.stopPropagation()
			openPreview(mediaType, id)
		}
	}

	function hrefFor(item: FeaturedItem) {
		return item.mediaType === 'tv' ? `/tv/${item.id}` : `/movie/${item.id}`
	}
</script>

<div class="flex items-center justify-between mb-4">
	<div>
		<h2 class="text-lg font-semibold" style="color: var(--color-ink-100)">Featured</h2>
		<p class="text-sm" style="color: var(--color-ink-500)">Picked from your library</p>
	</div>
	<span class="text-sm" style="color: var(--color-ink-500)">{items.length}</span>
</div>

<div
	class="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scroll-px-4"
	style="scrollbar-width: none"
>
	{#each items as item (item.mediaType + ':' + item.id)}
		<a
			href={hrefFor(item)}
			onclick={(e) => handleClick(e, item.mediaType, item.id)}
			onpointerdown={(e) => startHold(e, item.mediaType, item.id)}
			onpointermove={moveHold}
			onpointerup={endHold}
			onpointercancel={endHold}
			oncontextmenu={(e) => {
				e.preventDefault()
				abortHold()
				openContextMenu({
					x: e.clientX,
					y: e.clientY,
					mediaType: item.mediaType,
					id: item.id,
					title: item.title,
					poster_path: item.poster_path,
					backdrop_path: item.backdrop_path,
					release_date: item.release_date,
					vote_average: item.vote_average,
					genre_ids: [],
					href: hrefFor(item)
				})
			}}
			class="relative snap-start min-w-[320px] sm:min-w-130 h-60 sm:h-72 rounded-2xl overflow-hidden featured-card-hover"
			style="background: var(--color-surface-800); color: inherit"
		>
			{#if backdropUrl(item.backdrop_path, 'w1280')}
				<img
					src={backdropUrl(item.backdrop_path, 'w1280')}
					alt={item.title}
					class="featured-bg absolute inset-0 w-full h-full object-cover"
					loading="lazy"
				/>
			{:else}
				<img
					src={posterUrl(item.poster_path, 'w500')}
					alt={item.title}
					class="featured-bg absolute inset-0 w-full h-full object-cover"
					loading="lazy"
				/>
			{/if}

			<div
				class="absolute inset-0"
				style="background: linear-gradient(to top, color-mix(in srgb, var(--color-surface-950) 92%, transparent), color-mix(in srgb, var(--color-surface-950) 55%, transparent), transparent)"
			></div>

			<div class="relative h-full flex items-end gap-4 p-2 sm:p-3">
				<div
					class="w-20 sm:w-24 aspect-poster rounded-xl overflow-hidden shrink-0"
					style="background: var(--color-surface-700)"
				>
					<img
						src={posterUrl(item.poster_path, 'w342')}
						alt={item.title}
						class="w-full h-full object-cover"
						loading="lazy"
					/>
				</div>

				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2 flex-wrap mb-1">
						<span
							class="text-[11px] font-bold px-2 py-1 rounded-full"
							style="background: color-mix(in srgb, var(--color-surface-900) 70%, transparent); color: var(--color-ink-100); border: 1px solid color-mix(in srgb, var(--color-surface-700) 55%, transparent)"
						>{item.status === 'ready' ? 'Ready' : 'Not in library'}</span>
						{#if item.vote_average > 0}
							<span class="text-xs font-semibold" style="color: var(--color-amber-500)">★ {item.vote_average.toFixed(1)}</span>
						{/if}
						<span class="text-xs" style="color: var(--color-ink-300)">{formatYear(item.release_date)}</span>
						{#if item.byline}
							<span class="text-xs" style="color: var(--color-ink-300)">• {item.byline}</span>
						{/if}
					</div>

					<p class="text-base sm:text-lg font-bold leading-tight truncate" style="color: var(--color-ink-50)">{item.title}</p>
					{#if item.overview}
						<p class="text-sm mt-1 line-clamp-2" style="color: var(--color-ink-100)">{item.overview}</p>
					{/if}
				</div>
			</div>
		</a>
	{/each}
</div>
