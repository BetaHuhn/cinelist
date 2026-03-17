<script lang="ts">
	import { onMount } from 'svelte'
	import { fade } from 'svelte/transition'
	import { loadWatchlist, watchlist } from '$lib/stores/watchlist'
	import { favoritePeople, removePersonFromFavorites } from '$lib/stores/people'
	import { openPersonContextMenu } from '$lib/stores/personContextMenu'
	import type { WatchlistStatus, WatchlistItem } from '$lib/types/app'
	import type { TMDBMedia } from '$lib/types/tmdb'
	import type { LibraryCardSize } from '$lib/types/config'
	import type { PageData } from './$types'
	import { profileUrl } from '$lib/utils/image'
	import { addToast } from '$lib/stores/ui'
	import WatchlistEmpty from '$components/watchlist/WatchlistEmpty.svelte'
	import Button from '$components/ui/Button.svelte'
	import LibraryMediaCard from '$components/library/LibraryMediaCard.svelte'
	import FeaturedCarousel from '$components/library/FeaturedCarousel.svelte'
	import MovieGrid from '$components/movie/MovieGrid.svelte'
	import GraphView from '$components/library/GraphView.svelte'
	import { openDetailPreview } from '$lib/utils/preview'
	import { exportWatchlistToCSV } from '$lib/utils/export'
	import { page } from '$app/state'

	let { data }: { data: PageData } = $props()

	type SortOption =
		| 'added-desc'
		| 'added-asc'
		| 'title-asc'
		| 'title-desc'
		| 'rating-desc'
		| 'rating-asc'
		| 'year-desc'
		| 'year-asc'
		| 'user-rating-desc'
		| 'user-rating-asc'

	let activeFilter = $state<WatchlistStatus>('ready')
	let activeSort = $state<SortOption>('added-desc')
	let activeCardSize = $state<LibraryCardSize>('card')
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

	function isLibraryCardSize(value: unknown): value is LibraryCardSize {
		return value === 'card' || value === 'poster' || value === 'graph'
	}

	async function loadLibraryCardSizeConfig() {
		try {
			const res = await fetch('/api/config/libraryCardSize')
			if (!res.ok) return
			const payload = (await res.json()) as { value?: unknown }
			if (isLibraryCardSize(payload.value)) {
				activeCardSize = payload.value
			}
		} catch {}
	}

	async function persistLibraryCardSizeConfig(value: LibraryCardSize) {
		const res = await fetch('/api/config/libraryCardSize', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ value })
		})
		if (!res.ok) throw new Error('Save failed')
	}

	async function handleCardSizeChange(e: Event) {
		const value = (e.currentTarget as HTMLSelectElement).value
		if (!isLibraryCardSize(value) || value === activeCardSize) return

		const previous = activeCardSize
		activeCardSize = value
		try {
			await persistLibraryCardSizeConfig(value)
		} catch {
			activeCardSize = previous
			addToast('Could not save card size preference', 'error')
		}
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
		void loadLibraryCardSizeConfig()
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

	function sortItems(items: WatchlistItem[], sort: SortOption): WatchlistItem[] {
		return [...items].sort((a, b) => {
			switch (sort) {
				case 'added-asc':
					return a.addedAt - b.addedAt
				case 'title-asc':
					return a.title.localeCompare(b.title)
				case 'title-desc':
					return b.title.localeCompare(a.title)
				case 'rating-desc':
					return b.vote_average - a.vote_average
				case 'rating-asc':
					return a.vote_average - b.vote_average
				case 'year-desc':
					return (b.release_date ?? '').localeCompare(a.release_date ?? '')
				case 'year-asc':
					return (a.release_date ?? '').localeCompare(b.release_date ?? '')
				case 'user-rating-desc':
					// Unrated items (-1) sort to the bottom in both directions.
					return (b.userRating ?? -1) - (a.userRating ?? -1)
				case 'user-rating-asc':
					// Unrated items (6) sort to the bottom; max valid rating is 5.
					return (a.userRating ?? 6) - (b.userRating ?? 6)
				case 'added-desc':
				default:
					return b.addedAt - a.addedAt
			}
		})
	}

	const filtered = $derived.by(() => {
		const sort = activeSort
		const items = $watchlist
		let result: WatchlistItem[]
		if (activeFilter === 'ready') result = items.filter(i => i.onMediaServer && !i.watched)
		else if (activeFilter === 'pending') result = items.filter(i => !i.onMediaServer && !i.watched)
		else if (activeFilter === 'watched') result = items.filter(i => i.watched)
		else result = items
		return sortItems(result, sort)
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

	function asMedia(item: WatchlistItem): TMDBMedia {
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

	const filteredAsMedia = $derived.by(() => filtered.map(asMedia))

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
			{#if $watchlist.length > 0}
				<Button variant="ghost" size="sm" onclick={() => exportWatchlistToCSV($watchlist)}>
					Export CSV
				</Button>
			{/if}
			<Button variant="ghost" size="sm" loading={importing} onclick={triggerImport}>
				Import CSV
			</Button>
			<a
				href="/library/hidden"
				title="Hidden items"
				aria-label="Hidden items"
			>
				<Button variant="ghost" size="sm" class="py-2">
					<svg xmlns="http://www.w3.org/2000/svg" class="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" /><path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" /><path d="M3 3l18 18" /></svg>
				</Button>
			</a>
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
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						role="group"
						class="flex items-center gap-4 rounded-xl p-4"
						style="background: var(--color-surface-800)"
						oncontextmenu={(e) => {
							e.preventDefault()
							openPersonContextMenu({
								x: e.clientX,
								y: e.clientY,
								id: person.id,
								name: person.name,
								profile_path: person.profile_path ?? null,
								known_for_department: person.known_for_department ?? null,
								href: `/person/${person.id}`
							})
						}}
					>
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

	<!-- Filter tabs + card size selector -->
	<div class="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div class="w-full min-w-0 overflow-x-auto">
			<div class="flex w-max gap-1 rounded-xl p-1" style="background: var(--color-surface-800)">
				{#each tabs as tab (tab.value)}
					<button
						onclick={() => (activeFilter = tab.value)}
						class="whitespace-nowrap px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 ease-spring"
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
		</div>

		<div class="ml-auto flex items-center gap-2 self-end sm:self-auto">
			<label
				for="library-sort"
				class="whitespace-nowrap text-xs sm:text-sm"
				style="color: var(--color-ink-500)"
			>
				Sort
			</label>
			<select
				id="library-sort"
				bind:value={activeSort}
				class="text-xs sm:text-sm rounded-lg px-2.5 py-1.5 outline-0"
				style="background: var(--color-surface-800); color: var(--color-ink-100); border: 1px solid var(--color-surface-700)"
			>
				<option value="added-desc">↓ Date Added</option>
				<option value="added-asc">↑ Date Added</option>
				<option value="title-asc">↓ Title</option>
				<option value="title-desc">↑ Title</option>
				<option value="rating-desc">↓ TMDB Rating</option>
				<option value="rating-asc">↑ TMDB Rating</option>
				<option value="user-rating-desc">↓ My Rating</option>
				<option value="user-rating-asc">↑ My Rating</option>
				<option value="year-desc">↓ Year</option>
				<option value="year-asc">↑ Year</option>
			</select>
			<label
				for="library-card-size"
				class="whitespace-nowrap text-xs sm:text-sm"
				style="color: var(--color-ink-500)"
			>
				View
			</label>
			<select
				id="library-card-size"
				value={activeCardSize}
				onchange={handleCardSizeChange}
				class="text-xs sm:text-sm rounded-lg px-2.5 py-1.5 outline-0"
				style="background: var(--color-surface-800); color: var(--color-ink-100); border: 1px solid var(--color-surface-700)"
			>
				<option value="card">Cards</option>
				<option value="poster">Posters</option>
				<option value="graph">Graph</option>
			</select>
		</div>
	</div>

	{#if filtered.length === 0}
		<WatchlistEmpty filter={activeFilter} />
	{:else if activeCardSize === 'graph'}
		<GraphView items={filtered} onNodeClick={(item) => openPreview(item.mediaType, item.id)} />
	{:else if activeCardSize === 'poster'}
		<MovieGrid movies={filteredAsMedia} />
	{:else if activeCardSize === 'card'}
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
