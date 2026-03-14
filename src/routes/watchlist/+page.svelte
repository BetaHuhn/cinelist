<script lang="ts">
	import { onMount } from 'svelte'
	import { fade } from 'svelte/transition'
	import { loadWatchlist, watchlist } from '$lib/stores/watchlist'
	import type { WatchlistStatus, WatchlistItem } from '$lib/types/app'
	import type { PageData } from './$types'
	import { posterUrl } from '$lib/utils/image'
	import { formatYear } from '$lib/utils/format'
	import { addToast } from '$lib/stores/ui'
	import MediaServerBadge from '$components/watchlist/MediaServerBadge.svelte'
	import WatchlistButton from '$components/watchlist/WatchlistButton.svelte'
	import WatchlistEmpty from '$components/watchlist/WatchlistEmpty.svelte'
	import Button from '$components/ui/Button.svelte'
	import { openDetailPreview } from '$lib/utils/preview'
	import { page } from '$app/state'

	let { data }: { data: PageData } = $props()

	let activeFilter = $state<WatchlistStatus>('pending')
	let importing = $state(false)
	let fileInput = $state<HTMLInputElement | null>(null)

	const HOLD_MS = 450
	const MOVE_PX = 10
	let pressTimer: ReturnType<typeof setTimeout> | null = $state(null)
	let startX = $state(0)
	let startY = $state(0)
	let suppressClick = $state(false)
	let pendingPreview: { mediaType: 'movie' | 'tv'; id: number } | null = $state(null)

	onMount(() => {
		if ($watchlist.length === 0 && data.items.length > 0) {
			watchlist.set(data.items)
		}
	})

	const filtered = $derived.by(() => {
		const items = $watchlist
		if (activeFilter === 'on-server') return items.filter(i => i.onMediaServer)
		if (activeFilter === 'pending') return items.filter(i => !i.onMediaServer)
		return items
	})

	const tabs: { label: string; value: WatchlistStatus }[] = [
		{ label: 'All', value: 'all' },
		{ label: 'Pending', value: 'pending' },
		{ label: 'On Server', value: 'on-server' }
	]

	function hrefFor(item: WatchlistItem) {
		return item.mediaType === 'tv' ? `/tv/${item.id}` : `/movie/${item.id}`
	}

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

	function asMedia(item: WatchlistItem) {
		const base = {
			id: item.id,
			overview: '',
			poster_path: item.poster_path,
			backdrop_path: item.backdrop_path,
			vote_average: item.vote_average,
			vote_count: 0,
			genre_ids: item.genre_ids,
			popularity: 0,
			original_language: 'en' as const
		}
		return item.mediaType === 'tv'
			? { ...base, name: item.title, first_air_date: item.release_date }
			: { ...base, title: item.title, release_date: item.release_date }
	}

	async function triggerImport() {
		fileInput?.click()
	}

	async function handleImportFileChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement
		const file = input.files?.[0]
		if (!file) return
		importing = true
		try {
			const csv = await file.text()
			const res = await fetch('/api/watchlist/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ csv })
			})
			if (!res.ok) throw new Error('Import failed')
			const data = (await res.json()) as {
				added: number
				skippedExisting: number
				skippedNonMovie: number
				notFound: number
				errors?: { rowNumber: number; message: string }[]
			}

			await loadWatchlist()
			addToast(
				`Imported ${data.added} movie${data.added === 1 ? '' : 's'} (skipped ${data.skippedExisting}, not found ${data.notFound})`,
				data.added > 0 ? 'success' : 'info',
				4500
			)
		} catch {
			addToast('Import failed. Please check your CSV format.', 'error', 4500)
		} finally {
			importing = false
			input.value = ''
		}
	}
</script>

<svelte:head>
	<title>My Watchlist — CineList</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 py-8" in:fade={{ duration: 200 }}>
	<div class="flex items-center justify-between mb-6">
		<h1 class="text-2xl font-bold" style="color: var(--color-ink-50)">My Watchlist</h1>
		<div class="flex items-center gap-3">
				<span class="text-sm" style="color: var(--color-ink-500)">{$watchlist.length} items</span>
			<Button variant="ghost" size="sm" loading={importing} onclick={triggerImport}>
				Import CSV
			</Button>
			<input
				type="file"
				accept=".csv,text/csv"
				bind:this={fileInput}
				onchange={handleImportFileChange}
				class="hidden"
			/>
		</div>
	</div>

	<!-- Filter tabs -->
	<div class="flex gap-1 mb-8 p-1 rounded-xl w-fit" style="background: var(--color-surface-800)">
		{#each tabs as tab (tab.value)}
			<button
				onclick={() => (activeFilter = tab.value)}
				class="px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 ease-spring"
				style={activeFilter === tab.value
					? 'background: var(--color-surface-600); color: var(--color-ink-50)'
					: 'color: var(--color-ink-500)'}
			>
				{tab.label}
				{#if tab.value === 'all' && tab.value === activeFilter}
					<span class="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style="background: rgba(74,222,128,0.15); color: #4ade80">
						{$watchlist.length}
					</span>
				{/if}
				{#if tab.value === 'pending' && tab.value === activeFilter}
					<span class="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style="background: rgba(74,222,128,0.15); color: #4ade80">
						{$watchlist.filter(i => !i.onMediaServer).length}
					</span>
				{/if}
				{#if tab.value === 'on-server' && tab.value === activeFilter}
					<span class="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style="background: rgba(74,222,128,0.15); color: #4ade80">
						{$watchlist.filter(i => i.onMediaServer).length}
					</span>
				{/if}
			</button>
		{/each}
	</div>

	{#if filtered.length === 0}
		<WatchlistEmpty filter={activeFilter} />
	{:else}
		<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
			{#each filtered as item (item.mediaType + ':' + item.id)}
				<a
					href={hrefFor(item)}
					onclick={(e) => handleClick(e, item.mediaType, item.id)}
					onpointerdown={(e) => startHold(e, item.mediaType, item.id)}
					onpointermove={moveHold}
					onpointerup={endHold}
					onpointercancel={endHold}
					oncontextmenu={(e) => suppressClick && e.preventDefault()}
					class="group flex gap-4 rounded-xl overflow-hidden transition-colors card-hover"
					style="background: var(--color-surface-800)"
				>
					<!-- Poster -->
					<div class="w-20 flex-shrink-0" style="background: var(--color-surface-700)">
						<img
							src={posterUrl(item.poster_path, 'w185')}
							alt={item.title}
							class="w-full h-full object-cover"
							loading="lazy"
						/>
					</div>

					<!-- Info -->
					<div class="flex-1 py-3 pr-3 flex flex-col gap-2 min-w-0">
						<div>
							<p class="text-sm font-semibold leading-snug line-clamp-2" style="color: var(--color-ink-100)">{item.title}</p>
							<p class="text-xs mt-0.5" style="color: var(--color-ink-500)">{formatYear(item.release_date)}</p>
						</div>

						<div class="flex items-center gap-2 flex-wrap">
							<MediaServerBadge id={item.id} mediaType={item.mediaType} onMediaServer={item.onMediaServer} />
						</div>

						<div class="mt-auto flex items-center justify-between">
							{#if item.vote_average > 0}
								<span class="text-xs font-semibold" style="color: var(--color-amber-500)">★ {item.vote_average.toFixed(1)}</span>
							{/if}
							<div class="opacity-0 group-hover:opacity-100 transition-opacity">
								<WatchlistButton media={asMedia(item)} size="sm" />
							</div>
						</div>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
