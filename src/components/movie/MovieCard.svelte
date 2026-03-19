<script lang="ts">
	import { fly } from 'svelte/transition'
	import { page } from '$app/state'
	import { posterUrl } from '$lib/utils/image'
	import { formatYear } from '$lib/utils/format'
	import type { TMDBMedia } from '$lib/types/tmdb'
	import { watchlist } from '$lib/stores/watchlist'
	import WatchlistButton from '$components/watchlist/WatchlistButton.svelte'
	import { openDetailPreview } from '$lib/utils/preview'
	import { openContextMenu } from '$lib/stores/contextMenu'
  	import { buildJellyfinPlayUrl } from '$lib/utils/jellyfin';

	interface Props {
		movie: TMDBMedia
		index?: number
		favoritePeople?: { id: number; name: string }[]
		jellyfinUrl?: string
		hideState?: boolean
	}

	let { movie, index = 0, favoritePeople, jellyfinUrl, hideState = false }: Props = $props()
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
	const userRating = $derived(item?.userRating ?? null)

	const HOLD_MS = 450
	const MOVE_PX = 10
	let pressTimer: ReturnType<typeof setTimeout> | null = $state(null)
	let startX = $state(0)
	let startY = $state(0)
	let suppressClick = $state(false)
	let suppressNavOnce = $state(false)

	const jellyfinPlayUrl = $derived(
		jellyfinUrl && item?.jellyfinItemId
			? buildJellyfinPlayUrl(jellyfinUrl, item.jellyfinItemId)
			: null
	)

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
		// If the pointer interaction started on an interactive child (e.g. WatchlistButton),
		// suppress exactly the next link click. This also covers cases where the
		// pointer is released outside the button and the synthetic click targets the <a>.
		if (suppressNavOnce) {
			e.preventDefault()
			e.stopPropagation()
			suppressNavOnce = false
			return
		}
		// If the click originated from an interactive child (e.g. WatchlistButton),
		// suppress link navigation.
		if (isInteractiveTarget(e.target)) {
			e.preventDefault()
			e.stopPropagation()
			return
		}
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
		// If the interaction begins on an interactive child, don't start the preview
		// hold gesture and suppress the next link click.
		if (isInteractiveTarget(e.target)) {
			suppressNavOnce = true
			abortHold()
			return
		}
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
		// Clear suppression after the synthetic click (if any) had a chance to fire.
		if (suppressNavOnce) setTimeout(() => (suppressNavOnce = false), 0)
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
	oncontextmenu={(e) => {
		e.preventDefault()
		abortHold()
		openContextMenu({
			x: e.clientX,
			y: e.clientY,
			mediaType,
			id: movie.id,
			title,
			poster_path: movie.poster_path,
			backdrop_path: movie.backdrop_path ?? null,
			release_date: date,
			vote_average: movie.vote_average,
			genre_ids: movie.genre_ids ?? movie.genres?.map(g => g.id) ?? [],
			href
		})
	}}
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

		<!-- Favorite person badge -->
		{#if favoritePeople && favoritePeople.length > 0}
			<div class="absolute bottom-2 left-1.5 right-1.5 text-xs font-medium px-1 py-0.5 rounded-lg flex items-center gap-1 truncate" style="background: color-mix(in srgb, var(--color-surface-950) 80%, transparent); backdrop-filter: blur(4px); color: var(--color-amber-400); max-width: calc(100% - 0.75rem); width: fit-content;">
				<span>♥</span>
				<span class="truncate">{favoritePeople[0].name}</span>
				{#if favoritePeople.length > 1}
					<span>+{favoritePeople.length - 1}</span>
				{/if}
			</div>
		{/if}

		<!-- User rating badge -->
		{#if userRating !== null}
			<div class="absolute bottom-2 right-2 text-xs font-bold px-2 py-0.5 rounded-lg" style="background: color-mix(in srgb, var(--color-surface-950) 80%, transparent); backdrop-filter: blur(4px); color: var(--color-amber-300)">
				★ {userRating}
			</div>
		{/if}

		<!-- Unified state button: always visible -->
		{#if !hideState}
			<div class="absolute top-2 right-2">
				<WatchlistButton media={movie} size="md" hideDropdown hideTooltip hideLabel />
			</div>
		{/if}

		{#if jellyfinPlayUrl && hideState}
			<button
				type="button"
				data-no-preview
				aria-label="Play in Jellyfin"
				onclick={(e) => {
					e.preventDefault()
					e.stopPropagation()
					window.open(jellyfinPlayUrl, '_blank', 'noopener,noreferrer')
				}}
				class="opacity-0 group-hover:opacity-100 inline-flex group/jelly-btn absolute top-2 right-2 items-center gap-1.5 text-xs font-medium p-1.5 rounded-full transition-all duration-150 ease-spring active:scale-95 hover:scale-105"
				style="background: #000B25;"
			>
				<img src="/icons/jellyfin.svg" alt="" class="size-4 transition-opacity ease-in-out duration-150 opacity-75 group-hover/jelly-btn:opacity-100" />
				<!-- Watch -->
			</button>
		{/if}
	</div>

	<div class="p-3 flex flex-col gap-1 flex-1">
		<h3 class="text-sm font-semibold line-clamp-2 leading-snug" style="color: var(--color-ink-100)">{title}</h3>
		<p class="text-xs" style="color: var(--color-ink-500)">{formatYear(date)}</p>
	</div>
</a>
