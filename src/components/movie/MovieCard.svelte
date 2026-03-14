<script lang="ts">
	import { fly } from 'svelte/transition'
	import { page } from '$app/state'
	import { posterUrl } from '$lib/utils/image'
	import { formatYear } from '$lib/utils/format'
	import type { TMDBMedia } from '$lib/types/tmdb'
	import { watchlist } from '$lib/stores/watchlist'
	import WatchlistButton from '$components/watchlist/WatchlistButton.svelte'
	import { openDetailPreview } from '$lib/utils/preview'

	interface Props {
		movie: TMDBMedia
		index?: number
	}

	let { movie, index = 0 }: Props = $props()
	let imageLoaded = $state(false)

	const mediaType = $derived.by((): 'movie' | 'tv' => {
		const mt = 'media_type' in movie ? movie.media_type : undefined
		if (mt === 'movie' || mt === 'tv') return mt
		return 'title' in movie ? 'movie' : 'tv'
	})
	const title = $derived('title' in movie ? movie.title : movie.name)
	const date = $derived('release_date' in movie ? movie.release_date : movie.first_air_date)
	const href = $derived(mediaType === 'tv' ? `/tv/${movie.id}` : `/movie/${movie.id}`)

	const item = $derived($watchlist.find(i => i.id === movie.id && i.mediaType === mediaType))
	const saved = $derived(item !== undefined)
	const onServer = $derived(item?.onMediaServer ?? false)

	const HOLD_MS = 450
	const MOVE_PX = 10
	let pressTimer: ReturnType<typeof setTimeout> | null = $state(null)
	let startX = $state(0)
	let startY = $state(0)
	let suppressClick = $state(false)

	function fromPath(): string {
		return (page.state as App.PageState | undefined)?.preview?.from
			?? `${page.url.pathname}${page.url.search}${page.url.hash}`
	}

	function openPreview() {
		suppressClick = true
		openDetailPreview({ mediaType, id: movie.id, fromUrl: page.url, fromOverride: fromPath() })
	}

	function isInteractiveTarget(target: EventTarget | null): boolean {
		const el = target as HTMLElement | null
		return !!el?.closest('button, input, textarea, select, [role="button"], [data-no-preview]')
	}

	function handleClick(e: MouseEvent) {
		if (suppressClick) {
			e.preventDefault()
			e.stopPropagation()
			suppressClick = false
			return
		}
		if (e.shiftKey && !isInteractiveTarget(e.target)) {
			e.preventDefault()
			e.stopPropagation()
			openPreview()
		}
	}

	function abortHold() {
		if (pressTimer) {
			clearTimeout(pressTimer)
			pressTimer = null
		}
	}

	function startHold(e: PointerEvent) {
		if (isInteractiveTarget(e.target)) return
		if (e.button !== 0) return
		abortHold()
		startX = e.clientX
		startY = e.clientY
		pressTimer = setTimeout(() => {
			pressTimer = null
			openPreview()
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
	}
</script>

<a
	href={href}
	in:fly={{ y: 20, delay: Math.min(index, 8) * 40, duration: 300 }}
	class="group relative flex flex-col rounded-xl overflow-hidden card-hover"
	style="background: var(--color-surface-800)"
	onclick={handleClick}
	onpointerdown={startHold}
	onpointermove={moveHold}
	onpointerup={endHold}
	onpointercancel={endHold}
	oncontextmenu={(e) => suppressClick && e.preventDefault()}
>
	<div class="aspect-poster relative overflow-hidden" style="background: var(--color-surface-700)">
		{#if !imageLoaded}
			<div class="skeleton absolute inset-0 rounded-none"></div>
		{/if}
		<img
			src={posterUrl(movie.poster_path)}
			alt={title}
			class="w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
			class:opacity-0={!imageLoaded}
			onload={() => (imageLoaded = true)}
			loading="lazy"
		/>

		<!-- Rating badge -->
		{#if movie.vote_average > 0}
			<div class="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-lg" style="background: color-mix(in srgb, var(--color-surface-950) 80%, transparent); backdrop-filter: blur(4px); color: var(--color-amber-500)">
				★ {movie.vote_average.toFixed(1)}
			</div>
		{/if}

		<!-- On-server badge: always visible when on server -->
		{#if onServer}
			<div class="absolute bottom-2 left-2 flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style="background: color-mix(in srgb, #052e16 85%, transparent); backdrop-filter: blur(4px); color: #4ade80">
				<span class="size-1.5 rounded-full inline-block" style="background: #4ade80"></span>
				On Server
			</div>
		{/if}

		<!-- Watchlist button: always visible when saved, only on hover otherwise -->
		<div
			class="absolute top-2 right-2 transition-opacity duration-200"
			class:opacity-0={!saved}
			class:group-hover:opacity-100={true}
		>
			<WatchlistButton media={movie} size="sm" />
		</div>
	</div>

	<div class="p-3 flex flex-col gap-1 flex-1">
		<h3 class="text-sm font-semibold line-clamp-2 leading-snug" style="color: var(--color-ink-100)">{title}</h3>
		<p class="text-xs" style="color: var(--color-ink-500)">{formatYear(date)}</p>
	</div>
</a>
