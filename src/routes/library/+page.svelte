<script lang="ts">
	import { onMount } from 'svelte'
	import { fade } from 'svelte/transition'
	import { loadWatchlist, watchlist } from '$lib/stores/watchlist'
	import { favoritePeople, removePersonFromFavorites } from '$lib/stores/people'
	import type { WatchlistStatus, WatchlistItem } from '$lib/types/app'
	import type { PageData } from './$types'
	import { profileUrl } from '$lib/utils/image'
	import { addToast } from '$lib/stores/ui'
	import WatchlistEmpty from '$components/watchlist/WatchlistEmpty.svelte'
	import Button from '$components/ui/Button.svelte'
	import LibraryMediaCard from '$components/library/LibraryMediaCard.svelte'
	import FeaturedCarousel from '$components/library/FeaturedCarousel.svelte'
	import { openDetailPreview } from '$lib/utils/preview'
	import { page } from '$app/state'

	let { data }: { data: PageData } = $props()

	let activeFilter = $state<WatchlistStatus>('ready')
	let importing = $state(false)
	let fileInput = $state<HTMLInputElement | null>(null)

	const HOLD_MS = 450
	const MOVE_PX = 10
	let pressTimer: ReturnType<typeof setTimeout> | null = $state(null)
	let startX = $state(0)
	let startY = $state(0)
	let suppressClick = $state(false)
	let pendingPreview: { mediaType: 'movie' | 'tv'; id: number } | null = $state(null)

	let showAllPeople = $state(false)
	let peopleCols = $state(1)

	function computePeopleCols(width: number): number {
		// Matches Tailwind breakpoints used by the grid: sm (640px), lg (1024px)
		if (width >= 1024) return 3
		if (width >= 640) return 2
		return 1
	}

	onMount(() => {
		if ($watchlist.length === 0 && data.items.length > 0) {
			watchlist.set(data.items)
		}
		if ($favoritePeople.length === 0 && (data.people?.length ?? 0) > 0) {
			favoritePeople.set(data.people)
		}

		peopleCols = computePeopleCols(window.innerWidth)
		const onResize = () => {
			peopleCols = computePeopleCols(window.innerWidth)
		}
		window.addEventListener('resize', onResize, { passive: true })
		return () => window.removeEventListener('resize', onResize)
	})

	async function removeFavoritePerson(id: unknown) {
		const safeId = typeof id === 'number' ? id : Number(id)
		if (!Number.isFinite(safeId) || safeId <= 0) {
			addToast('Invalid person id', 'error')
			return
		}
		try {
			await removePersonFromFavorites(safeId)
			addToast('Removed from favorites', 'success')
		} catch {
			addToast('Could not update favorites', 'error')
		}
	}

	const safeFavoritePeople = $derived.by(() => {
		return ($favoritePeople as any[])
			.map((p) => {
				const id = typeof p?.id === 'number' ? p.id : Number(p?.id)
				return {
					...(p ?? {}),
					id
				}
			})
			.filter((p) => Number.isFinite(p.id) && p.id > 0)
	})

	const maxCollapsedPeople = $derived.by(() => Math.max(0, peopleCols * 2))
	const canExpandPeople = $derived.by(() => safeFavoritePeople.length > maxCollapsedPeople)
	const visibleFavoritePeople = $derived.by(() =>
		showAllPeople || !canExpandPeople
			? safeFavoritePeople
			: safeFavoritePeople.slice(0, maxCollapsedPeople)
	)

	const filtered = $derived.by(() => {
		const items = $watchlist
		if (activeFilter === 'ready') return items.filter(i => i.onMediaServer && !i.watched)
		if (activeFilter === 'pending') return items.filter(i => !i.onMediaServer && !i.watched)
		if (activeFilter === 'watched') return items.filter(i => i.watched)
		return items
	})

	const readyCount = $derived.by(() => $watchlist.filter(i => i.onMediaServer && !i.watched).length)
	const pendingCount = $derived.by(() => $watchlist.filter(i => !i.onMediaServer && !i.watched).length)
	const watchedCount = $derived.by(() => $watchlist.filter(i => i.watched).length)

	const featured = $derived.by(() => data.featured ?? [])

	const tabs: { label: string; value: WatchlistStatus }[] = [
		{ label: 'Ready to Watch', value: 'ready' },
		{ label: 'Not in Library', value: 'pending' },
		{ label: 'Watched', value: 'watched' },
		{ label: 'All', value: 'all' }
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
	<title>My Library — CineList</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 py-8" in:fade={{ duration: 200 }}>
	<div class="flex items-center justify-between mb-6">
		<h1 class="text-2xl font-bold" style="color: var(--color-ink-50)">My Library</h1>
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

	{#if featured.length > 0}
		<div class="mb-10">
			<FeaturedCarousel items={featured} />
		</div>
	{/if}

	{#if safeFavoritePeople.length > 0}
		<div class="mb-10">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-lg font-semibold" style="color: var(--color-ink-100)">Favorite People</h2>
				<div class="flex items-center gap-2">
					<span class="text-sm" style="color: var(--color-ink-500)">{safeFavoritePeople.length}</span>
					{#if canExpandPeople}
						<Button
							variant="ghost"
							size="sm"
							onclick={() => (showAllPeople = !showAllPeople)}
						>
							{showAllPeople ? 'View Less' : 'View All'}
						</Button>
					{/if}
				</div>
			</div>
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each visibleFavoritePeople as person (person.id)}
					<div class="flex items-center gap-4 rounded-xl p-4" style="background: var(--color-surface-800)">
						<a href={`/person/${person.id}`} class="flex items-center gap-4 min-w-0 flex-1" style="color: inherit">
							<div class="size-12 rounded-full overflow-hidden shrink-0" style="background: var(--color-surface-700)">
								<img
									src={profileUrl(person.profile_path, 'w185')}
									alt={person.name}
									class="w-full h-full object-cover"
									loading="lazy"
								/>
							</div>
							<div class="min-w-0">
								<p class="text-sm font-semibold truncate" style="color: var(--color-ink-100)">{person.name}</p>
								{#if person.known_for_department}
									<p class="text-xs truncate" style="color: var(--color-ink-500)">{person.known_for_department}</p>
								{/if}
							</div>
						</a>
						<Button variant="ghost" size="sm" onclick={() => removeFavoritePerson(person.id)}>
							Remove
						</Button>
					</div>
				{/each}
			</div>
		</div>
	{/if}

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
				<!-- {#if tab.value === activeFilter}
					<span class="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style="background: rgba(74,222,128,0.15); color: #4ade80">
						{#if tab.value === 'all'}
							{$watchlist.length}
						{:else if tab.value === 'ready'}
							{readyCount}
						{:else if tab.value === 'pending'}
							{pendingCount}
						{:else}
							{watchedCount}
						{/if}
					</span>
				{/if} -->
			</button>
		{/each}
	</div>

	{#if filtered.length === 0}
		<WatchlistEmpty filter={activeFilter} />
	{:else}
		<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
			{#each filtered as item (item.mediaType + ':' + item.id)}
				<LibraryMediaCard
					{item}
					{handleClick}
					{startHold}
					{moveHold}
					{endHold}
					suppressClick={suppressClick}
				/>
			{/each}
		</div>
	{/if}
</div>
