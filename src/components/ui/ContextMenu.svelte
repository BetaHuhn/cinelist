<script lang="ts">
	import { get } from 'svelte/store'
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { contextMenu, closeContextMenu } from '$lib/stores/contextMenu'
	import {
		watchlist,
		addToWatchlist,
		removeFromWatchlist,
		toggleMediaServer,
		toggleWatched
	} from '$lib/stores/watchlist'
	import { blacklist, addToBlacklist, removeFromBlacklist } from '$lib/stores/blacklist'
	import { addToast } from '$lib/stores/ui'
	import { openDetailPreview } from '$lib/utils/preview'
	import type { TMDBMedia } from '$lib/types/tmdb'

	const ctx = $derived($contextMenu)
	const open = $derived(ctx.open)

	const item = $derived($watchlist.find(i => i.id === ctx.id && i.mediaType === ctx.mediaType))
	const inList = $derived(item !== undefined)
	const watchlistStatus = $derived<'none' | 'watchlist' | 'ready' | 'watched'>(
		!inList
			? 'none'
			: item!.watched
				? 'watched'
				: item!.onMediaServer
					? 'ready'
					: 'watchlist'
	)
	const isBlacklisted = $derived(
		$blacklist.some(i => i.id === ctx.id && i.mediaType === ctx.mediaType)
	)

	let menuEl = $state<HTMLDivElement | null>(null)
	let stateSubmenuOpen = $state(false)
	let adjustedX = $state(0)
	let adjustedY = $state(0)
	let visible = $state(false)

	$effect(() => {
		if (!open) {
			visible = false
			stateSubmenuOpen = false
			return
		}

		adjustedX = ctx.x
		adjustedY = ctx.y
		visible = false

		requestAnimationFrame(() => {
			if (!menuEl || !open) return
			const { innerWidth, innerHeight } = window
			const { offsetWidth, offsetHeight } = menuEl

			let x = ctx.x
			let y = ctx.y

			if (x + offsetWidth > innerWidth - 8) x = innerWidth - offsetWidth - 8
			if (y + offsetHeight > innerHeight - 8) y = innerHeight - offsetHeight - 8
			if (x < 8) x = 8
			if (y < 8) y = 8

			adjustedX = x
			adjustedY = y
			visible = true
		})
	})

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopPropagation()
			closeContextMenu()
		}
	}

	function handleOutsideClick(e: MouseEvent) {
		if (menuEl && !menuEl.contains(e.target as Node)) closeContextMenu()
	}

	function buildMedia(): TMDBMedia {
		const { id, mediaType, title, poster_path, backdrop_path, release_date, vote_average, genre_ids } = ctx
		if (mediaType === 'movie') {
			return {
				id,
				title,
				overview: '',
				poster_path,
				backdrop_path,
				release_date,
				vote_average,
				vote_count: 0,
				genre_ids,
				media_type: 'movie'
			}
		}
		return {
			id,
			name: title,
			overview: '',
			poster_path,
			backdrop_path,
			first_air_date: release_date,
			vote_average,
			vote_count: 0,
			genre_ids,
			media_type: 'tv'
		}
	}

	async function handleOpen() {
		closeContextMenu()
		await goto(ctx.href)
	}

	function handlePreview() {
		const { mediaType, id } = ctx
		closeContextMenu()
		openDetailPreview({ mediaType, id, fromUrl: page.url })
	}

	async function handleCopyUrl() {
		const href = ctx.href
		closeContextMenu()
		try {
			const url = `${window.location.origin}${href}`
			await navigator.clipboard.writeText(url)
			addToast('URL copied to clipboard', 'success')
		} catch {
			addToast('Failed to copy URL', 'error')
		}
	}

	async function handleBlacklist() {
		const { id, mediaType, title, poster_path } = ctx
		const wasBlacklisted = isBlacklisted
		closeContextMenu()
		try {
			if (wasBlacklisted) {
				await removeFromBlacklist(id, mediaType)
				addToast('Removed from hidden items', 'success')
			} else {
				await addToBlacklist({ id, mediaType, title, poster_path })
				addToast('Hidden permanently', 'success')
			}
		} catch {
			addToast('Something went wrong', 'error')
		}
	}

	async function handleSaveToWatchlist() {
		const media = buildMedia()
		closeContextMenu()
		try {
			await addToWatchlist(media)
			addToast('Added to watchlist', 'success')
		} catch {
			addToast('Something went wrong', 'error')
		}
	}

	async function setWatchlistState(next: 'watchlist' | 'ready' | 'watched' | 'none') {
		const { id, mediaType } = ctx
		const wasInList = inList
		const media = buildMedia()
		closeContextMenu()
		try {
			if (next === 'none') {
				await removeFromWatchlist(id, mediaType)
				addToast('Removed from watchlist', 'success')
				return
			}

			if (!wasInList) {
				await addToWatchlist(media)
			}

			const current = get(watchlist).find(i => i.id === id && i.mediaType === mediaType)
			if (!current) return

			if (next === 'watchlist') {
				if (current.watched) await toggleWatched(id, mediaType)
				if (current.onMediaServer) await toggleMediaServer(id, mediaType)
				addToast('Set to On Watchlist', 'success')
			} else if (next === 'ready') {
				if (current.watched) await toggleWatched(id, mediaType)
				if (!current.onMediaServer) await toggleMediaServer(id, mediaType)
				addToast('Marked as ready to watch', 'success')
			} else if (next === 'watched') {
				if (current.onMediaServer) await toggleMediaServer(id, mediaType)
				if (!current.watched) await toggleWatched(id, mediaType)
				addToast('Marked as watched', 'success')
			}
		} catch {
			addToast('Something went wrong', 'error')
		}
	}
</script>

<svelte:window
	onkeydown={(e) => { if (open) handleKeydown(e) }}
	onclick={(e) => { if (open) handleOutsideClick(e) }}
/>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={menuEl}
		role="menu"
		tabindex="-1"
		aria-label="Card actions"
		class="fixed z-[200] min-w-56 rounded-xl shadow-2xl py-1"
		style="left: {adjustedX}px; top: {adjustedY}px; visibility: {visible ? 'visible' : 'hidden'}; background: var(--color-surface-800); border: 1px solid color-mix(in srgb, var(--color-surface-600) 60%, transparent); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6)"
		onkeydown={(e) => e.stopPropagation()}
	>
		<!-- Open -->
		<button
			role="menuitem"
			type="button"
			onclick={handleOpen}
			class="w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors duration-100"
			style="color: var(--color-ink-100)"
			onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-700)' }}
			onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="size-4 shrink-0" style="color: var(--color-ink-500)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" /><path d="M11 13l9 -9" /><path d="M15 4h5v5" /></svg>
			Open
		</button>

		<!-- Preview -->
		<button
			role="menuitem"
			type="button"
			onclick={handlePreview}
			class="w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors duration-100"
			style="color: var(--color-ink-100)"
			onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-700)' }}
			onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="size-4 shrink-0" style="color: var(--color-ink-500)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" /></svg>
			Preview
		</button>

		<!-- Separator -->
		<div class="my-1 mx-2" style="border-top: 1px solid var(--color-surface-700)"></div>

		<!-- Watchlist section -->
		{#if !inList}
			<button
				role="menuitem"
				type="button"
				onclick={handleSaveToWatchlist}
				class="w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors duration-100"
				style="color: var(--color-amber-500)"
				onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-700)' }}
				onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
				Save to Watchlist
			</button>
		{:else}
			<!-- Change State with inline submenu -->
			<button
				role="menuitem"
				type="button"
				onclick={(e) => { e.stopPropagation(); stateSubmenuOpen = !stateSubmenuOpen }}
				class="w-full text-left px-4 py-2 text-sm flex items-center gap-3 justify-between transition-colors duration-100"
				style="color: var(--color-ink-100)"
				onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-700)' }}
				onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}
				aria-expanded={stateSubmenuOpen}
				aria-haspopup="true"
			>
				<span class="flex items-center gap-3">
					<svg xmlns="http://www.w3.org/2000/svg" class="size-4 shrink-0" style="color: var(--color-ink-500)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" /><path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z" /><path d="M16 5l3 3" /></svg>
					Change State
				</span>
				<svg xmlns="http://www.w3.org/2000/svg" class="size-3.5 shrink-0 transition-transform duration-150" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-ink-500); transform: rotate({stateSubmenuOpen ? 180 : 0}deg)"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 9l6 6l6 -6" /></svg>
			</button>

			{#if stateSubmenuOpen}
				<div class="mx-2 mb-1 rounded-lg overflow-hidden" style="background: var(--color-surface-900)">
					<button
						role="menuitem"
						type="button"
						onclick={() => setWatchlistState('watchlist')}
						class="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors duration-100"
						style="color: {watchlistStatus === 'watchlist' ? 'var(--color-amber-500)' : 'var(--color-ink-300)'}"
						onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-700)' }}
						onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}
					>
						<span style="color: var(--color-amber-500)">★</span>
						On Watchlist
						{#if watchlistStatus === 'watchlist'}<span class="ml-auto text-xs" style="color: var(--color-ink-500)">current</span>{/if}
					</button>

					<button
						role="menuitem"
						type="button"
						onclick={() => setWatchlistState('ready')}
						class="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors duration-100"
						style="color: {watchlistStatus === 'ready' ? '#4ade80' : 'var(--color-ink-300)'}"
						onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-700)' }}
						onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}
					>
						<span style="color: #4ade80">★</span>
						Ready to Watch
						{#if watchlistStatus === 'ready'}<span class="ml-auto text-xs" style="color: var(--color-ink-500)">current</span>{/if}
					</button>

					<button
						role="menuitem"
						type="button"
						onclick={() => setWatchlistState('watched')}
						class="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors duration-100"
						style="color: {watchlistStatus === 'watched' ? '#4ade80' : 'var(--color-ink-300)'}"
						onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-700)' }}
						onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}
					>
						<span style="color: #4ade80">✓</span>
						Watched
						{#if watchlistStatus === 'watched'}<span class="ml-auto text-xs" style="color: var(--color-ink-500)">current</span>{/if}
					</button>

					<div class="mx-2 my-0.5" style="border-top: 1px solid var(--color-surface-700)"></div>

					<button
						role="menuitem"
						type="button"
						onclick={() => setWatchlistState('none')}
						class="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors duration-100"
						style="color: var(--color-ink-300)"
						onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-700)' }}
						onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
						Remove from Watchlist
					</button>
				</div>
			{/if}
		{/if}

		<!-- Separator -->
		<div class="my-1 mx-2" style="border-top: 1px solid var(--color-surface-700)"></div>

		<!-- Copy URL -->
		<button
			role="menuitem"
			type="button"
			onclick={handleCopyUrl}
			class="w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors duration-100"
			style="color: var(--color-ink-100)"
			onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-700)' }}
			onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="size-4 shrink-0" style="color: var(--color-ink-500)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 15l6 -6" /><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464" /><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463" /></svg>
			Copy Link
		</button>

		<!-- Separator -->
		<div class="my-1 mx-2" style="border-top: 1px solid var(--color-surface-700)"></div>

		<!-- Hide/Show -->
		<button
			role="menuitem"
			type="button"
			onclick={handleBlacklist}
			class="w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors duration-100"
			style="color: {isBlacklisted ? 'var(--color-ink-300)' : '#f87171'}"
			onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-700)' }}
			onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}
		>
			{#if isBlacklisted}
				<svg xmlns="http://www.w3.org/2000/svg" class="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" /></svg>
				Show Again
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" class="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" /><path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" /><path d="M3 3l18 18" /></svg>
				Hide Permanently
			{/if}
		</button>
	</div>
{/if}
