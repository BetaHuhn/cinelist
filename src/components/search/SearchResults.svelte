<script lang="ts">
	import { fly } from 'svelte/transition'
	import { tick } from 'svelte'
	import { page } from '$app/state'
	import { goto } from '$app/navigation'
	import { posterUrl, profileUrl } from '$lib/utils/image'
	import { formatYear } from '$lib/utils/format'
	import type { TMDBMediaResult, TMDBPerson } from '$lib/types/tmdb'
	import { watchlist } from '$lib/stores/watchlist'
	import { openDetailPreview } from '$lib/utils/preview'

	interface Props {
		mediaResults: TMDBMediaResult[]
		peopleResults: TMDBPerson[]
		selectedIndex?: number
		onclose?: () => void
	}

	let { mediaResults, peopleResults, selectedIndex = -1, onclose }: Props = $props()

	const mediaTop = $derived(mediaResults.slice(0, 8))
	const peopleTop = $derived(peopleResults.slice(0, 4))
	const peopleOffset = $derived(mediaTop.length)

	$effect(() => {
		if (typeof document === 'undefined') return
		if (selectedIndex < 0) return
		void tick().then(() => {
			const el = document.querySelector<HTMLElement>(`[data-suggestion-index="${selectedIndex}"]`)
			el?.scrollIntoView({ block: 'nearest' })
		})
	})

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
		if (onclose) onclose()
	}

	function abortHold() {
		if (pressTimer) {
			clearTimeout(pressTimer)
			pressTimer = null
		}
	}

	function startHold(e: PointerEvent, mediaType: 'movie' | 'tv', id: number) {
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
		if (e.shiftKey) {
			e.preventDefault()
			e.stopPropagation()
			openPreview(mediaType, id)
			return
		}
		if (onclose) onclose()
	}

	function handlePersonClick(e: MouseEvent, id: number) {
		e.preventDefault()
		if (onclose) onclose()
		goto(`/person/${id}`)
	}
</script>

<div
	in:fly={{ y: -8, duration: 200 }}
	class="absolute top-full left-0 right-0 mt-2 glass rounded-xl overflow-hidden shadow-2xl z-20 max-h-96 overflow-y-auto"
>
	{#if mediaTop.length > 0}
		<div class="px-4 py-2 text-[11px] font-semibold" style="color: var(--color-ink-500); border-bottom: 1px solid var(--color-surface-700)">
			Movies & TV
		</div>
	{/if}

	{#each mediaTop as movie, i (movie.media_type + ':' + movie.id)}
		{@const mediaType = movie.media_type}
		{@const title = movie.media_type === 'movie' ? movie.title : movie.name}
		{@const date = movie.media_type === 'movie' ? movie.release_date : movie.first_air_date}
		{@const href = movie.media_type === 'tv' ? `/tv/${movie.id}` : `/movie/${movie.id}`}
		{@const item = $watchlist.find(i => i.id === movie.id && i.mediaType === mediaType)}
		{@const onServer = item?.onMediaServer ?? false}
		{@const watched = item?.watched ?? false}
		{@const indicator = !item ? null : watched ? '✓' : '★'}
		{@const indicatorColor = !item
			? ''
			: watched || onServer
				? '#4ade80'
				: 'var(--color-amber-500)'
		}
		{@const isSelected = selectedIndex === i}
		<a
			href={href}
			data-suggestion-index={i}
			onclick={(e) => handleClick(e, mediaType, movie.id)}
			onpointerdown={(e) => startHold(e, mediaType, movie.id)}
			onpointermove={moveHold}
			onpointerup={endHold}
			onpointercancel={endHold}
			oncontextmenu={(e) => suppressClick && e.preventDefault()}
			class="flex items-center gap-3 px-4 py-3 transition-colors text-left"
			style="color: inherit; background: {isSelected ? 'var(--color-surface-700)' : ''}"
			onmouseenter={(e) => {
				if (isSelected) return
				;(e.currentTarget as HTMLElement).style.background = 'var(--color-surface-700)'
			}}
			onmouseleave={(e) => {
				if (isSelected) return
				;(e.currentTarget as HTMLElement).style.background = ''
			}}
		>
			<img
				src={posterUrl(movie.poster_path, 'w185')}
				alt={title}
				class="size-12 rounded-lg object-cover flex-shrink-0"
				style="background: var(--color-surface-700)"
			/>
			<div class="flex-1 min-w-0 text-left">
				<p class="text-sm font-medium truncate" style="color: var(--color-ink-100)">{title}</p>
				<p class="text-xs" style="color: var(--color-ink-500)">{formatYear(date)}</p>
			</div>
			<div class="flex items-center gap-2 flex-shrink-0">
				{#if indicator}
					<span class="text-sm font-bold" style="color: {indicatorColor}">{indicator}</span>
				{/if}
				{#if movie.vote_average > 0}
					<span class="text-xs font-semibold" style="color: var(--color-amber-500)">★ {movie.vote_average.toFixed(1)}</span>
				{/if}
			</div>
		</a>
	{/each}

	{#if mediaResults.length > 8}
		<p class="text-xs text-center py-2" style="color: var(--color-ink-500); border-top: 1px solid var(--color-surface-700)">
			+{mediaResults.length - 8} more results
		</p>
	{/if}

	{#if peopleTop.length > 0}
		<div class="px-4 py-2 text-[11px] font-semibold" style="color: var(--color-ink-500); border-bottom: 1px solid var(--color-surface-700)">
			People
		</div>
		{#each peopleTop as person, i (person.id)}
			{@const idx = peopleOffset + i}
			{@const isSelected = selectedIndex === idx}
			<a
				href={`/person/${person.id}`}
				data-suggestion-index={idx}
				onclick={(e) => handlePersonClick(e, person.id)}
				class="flex items-center gap-3 px-4 py-3 transition-colors text-left"
				style="color: inherit; background: {isSelected ? 'var(--color-surface-700)' : ''}"
				onmouseenter={(e) => {
					if (isSelected) return
					;(e.currentTarget as HTMLElement).style.background = 'var(--color-surface-700)'
				}}
				onmouseleave={(e) => {
					if (isSelected) return
					;(e.currentTarget as HTMLElement).style.background = ''
				}}
			>
				<img
					src={profileUrl(person.profile_path, 'w45')}
					alt={person.name}
					class="size-10 rounded-full object-cover flex-shrink-0"
					style="background: var(--color-surface-700)"
				/>
				<div class="flex-1 min-w-0 text-left">
					<p class="text-sm font-medium truncate" style="color: var(--color-ink-100)">{person.name}</p>
					{#if person.known_for_department}
						<p class="text-xs truncate" style="color: var(--color-ink-500)">{person.known_for_department}</p>
					{/if}
				</div>
			</a>
		{/each}
	{/if}
</div>
