<script lang="ts">
	import { fade } from 'svelte/transition'
	import { page } from '$app/state'
	import type { PageData } from './$types'
	import { posterUrl } from '$lib/utils/image'
	import { openDetailPreview } from '$lib/utils/preview'
	import { isEditableTarget } from '$lib/utils/keyboard'
	import { GENRE_NAMES } from '$lib/utils/graph'
	import TrailerButton from '$components/movie/TrailerButton.svelte'
	import TrailerModal from '$components/modals/TrailerModal.svelte'
	import JellyfinPlayButton from '$components/watchlist/JellyfinPlayButton.svelte'
	import { watchlist } from '$lib/stores/watchlist'
	import type { TMDBVideo } from '$lib/types/tmdb'
	import type { WatchlistItem } from '$lib/types/app'
	import type { MoodKey, MoodRecommendationCandidate } from '$lib/server/moodRecommendations'

	let { data }: { data: PageData } = $props()

	let activeItem = $state<MoodRecommendationCandidate | null>(null)
	let viewportWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 1280)
	let moodMenu = $state<HTMLDetailsElement | undefined>()

	function itemKey(item: { mediaType: string; id: number }): string {
		return `${item.mediaType}:${item.id}`
	}

	function shuffleArray<T>(items: T[]): T[] {
		const pool = [...items]
		for (let i = pool.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1))
			;[pool[i], pool[j]] = [pool[j], pool[i]]
		}
		return pool
	}

	// Ready-to-watch titles are preferred everywhere a recommendation gets
	// picked; the rest of the pool is only used once there are no ready ones left.
	function sampleWithReadyPreference<T extends { onMediaServer: boolean }>(items: T[], count: number): T[] {
		const ready = shuffleArray(items.filter(item => item.onMediaServer))
		const rest = shuffleArray(items.filter(item => !item.onMediaServer))
		return [...ready, ...rest].slice(0, Math.max(0, count))
	}

	function watchlistItemToCandidate(item: WatchlistItem): MoodRecommendationCandidate {
		return {
			mediaType: item.mediaType,
			id: item.id,
			title: item.title,
			poster_path: item.poster_path,
			backdrop_path: item.backdrop_path,
			release_date: item.release_date,
			vote_average: item.vote_average,
			overview: '',
			genre_ids: item.genre_ids,
			onMediaServer: item.onMediaServer,
			watched: item.watched,
			userRating: item.userRating,
			score: 0,
			matchedGenres: [],
			source: 'watchlist'
		}
	}

	$effect(() => {
		function onResize() {
			viewportWidth = window.innerWidth
		}
		window.addEventListener('resize', onResize)
		return () => window.removeEventListener('resize', onResize)
	})

	$effect(() => {
		function onDocumentClick(e: MouseEvent) {
			if (!moodMenu?.open) return
			if (moodMenu.contains(e.target as Node)) return
			moodMenu.open = false
		}
		document.addEventListener('click', onDocumentClick)
		return () => document.removeEventListener('click', onDocumentClick)
	})

	function closeMoodMenu() {
		if (moodMenu) moodMenu.open = false
	}

	const hasMood = $derived(data.mood !== null)
	const activeMood = $derived((data.mood ?? 'cozy') as MoodKey)
	const activeMoodOption = $derived.by(() => data.moodOptions.find(option => option.key === data.mood) ?? null)
	const recommendations = $derived((data.recommendations ?? []) as MoodRecommendationCandidate[])
	const activeRecommendation = $derived(activeItem)

	const watchlistByKey = $derived.by(() => new Map($watchlist.map(item => [itemKey(item), item])))

	// Reset the center pick (and the background set below) whenever the mood
	// itself changes, so a new mood never inherits stale selections from the
	// previous one. Runs before the orbit-computation effect so that one
	// always sees a clean slate on a mood switch.
	let lastMoodKey: string | null | undefined = undefined
	$effect(() => {
		if (data.mood === lastMoodKey) return
		lastMoodKey = data.mood
		// `recommendations` is already sorted by score, so the first ready
		// title in that order is the best ready match; fall back to the
		// overall top match if nothing is ready yet.
		const readyItem = recommendations.find(item => item.onMediaServer)
		activeItem = readyItem ?? recommendations[0] ?? null
		orbitItems = []
	})

	// Watchlist-sourced candidates don't carry a TMDB overview or trailer, so
	// fetch the real synopsis and trailer for whichever title is centered.
	// The same response also carries TMDB's "related" titles, which we cache
	// (as bare ids) to compute the background from below.
	let overviewCache = $state<Record<string, string>>({})
	let trailerCache = $state<Record<string, TMDBVideo | null>>({})
	let relatedIdsCache = $state<Record<string, number[]>>({})
	const activeOverview = $derived.by(() => {
		if (!activeRecommendation) return ''
		if (activeRecommendation.overview) return activeRecommendation.overview
		return overviewCache[itemKey(activeRecommendation)] ?? ''
	})
	const activeTrailer = $derived.by(() => {
		if (!activeRecommendation) return null
		return trailerCache[itemKey(activeRecommendation)] ?? null
	})

	// Loading flags so the UI can show a proper skeleton/placeholder instead of
	// either stale content from the previous center or a flash of fallback
	// content that gets silently replaced once the fetch resolves.
	const overviewPending = $derived(!!activeRecommendation && !activeRecommendation.overview && !(itemKey(activeRecommendation) in overviewCache))
	const trailerPending = $derived(!!activeRecommendation && !(itemKey(activeRecommendation) in trailerCache))
	const relatedPending = $derived(!!activeRecommendation && !(itemKey(activeRecommendation) in relatedIdsCache))

	let showTrailer = $state(false)
	$effect(() => {
		void activeRecommendation
		showTrailer = false
	})

	$effect(() => {
		const item = activeRecommendation
		if (!item) return
		const key = itemKey(item)
		const needsOverview = !item.overview && !(key in overviewCache)
		const needsRelated = !(key in relatedIdsCache)
		if (!needsOverview && !needsRelated) return

		const ac = new AbortController()
		;(async () => {
			const endpoint = item.mediaType === 'movie' ? `/api/detail/movie/${item.id}` : `/api/detail/tv/${item.id}`
			const res = await fetch(endpoint, { signal: ac.signal })
			if (!res.ok) throw new Error(`Failed to load detail (${res.status})`)
			const detail = await res.json() as {
				movie?: { overview?: string; trailer?: TMDBVideo | null }
				tv?: { overview?: string; trailer?: TMDBVideo | null }
				related?: { id: number }[]
			}
			const overview = detail.movie?.overview ?? detail.tv?.overview ?? ''
			const trailer = detail.movie?.trailer ?? detail.tv?.trailer ?? null
			overviewCache = { ...overviewCache, [key]: overview }
			trailerCache = { ...trailerCache, [key]: trailer }
			relatedIdsCache = { ...relatedIdsCache, [key]: (detail.related ?? []).map(r => r.id) }
		})().catch(() => {
			if (ac.signal.aborted) return
			overviewCache = { ...overviewCache, [key]: overviewCache[key] ?? '' }
			trailerCache = { ...trailerCache, [key]: trailerCache[key] ?? null }
			relatedIdsCache = { ...relatedIdsCache, [key]: relatedIdsCache[key] ?? [] }
		})

		return () => ac.abort()
	})

	// Below 768px there isn't enough room beside the center card for any orbit
	// radius that also clears it, so related titles become a scrollable strip
	// instead of floating nodes. Above that, two tiers of hand-checked radii
	// keep every card clear of both the center card and the canvas edges.
	const layoutTier = $derived(viewportWidth >= 1120 ? 'wide' : viewportWidth >= 768 ? 'medium' : 'compact')
	const maxOrbitCards = $derived(layoutTier === 'wide' ? 6 : layoutTier === 'medium' ? 4 : 6)

	// The background is always computed from the current center: titles TMDB
	// considers related to it that are also on the watchlist (preferring
	// ready-to-watch ones), topped up from the mood pool if there aren't
	// enough related-and-on-watchlist titles to fill every slot. This makes
	// shuffling or clicking a background card feel like navigating a space of
	// related watchlist titles rather than cycling a flat list.
	let orbitItems = $state<MoodRecommendationCandidate[]>([])

	$effect(() => {
		const center = activeItem
		if (!center) {
			orbitItems = []
			return
		}

		const key = itemKey(center)
		if (!(key in relatedIdsCache)) {
			// Still waiting on the related-titles fetch — leave the background
			// empty (the template shows skeleton placeholders via `relatedPending`)
			// rather than computing a fallback-only set now and replacing it a
			// moment later once the real related data arrives.
			orbitItems = []
			return
		}

		const relatedIds = relatedIdsCache[key] ?? []
		const relatedCandidates = relatedIds
			.map(id => watchlistByKey.get(`${center.mediaType}:${id}`))
			.filter((w): w is WatchlistItem => !!w && !w.watched && w.id !== center.id)
			.map(watchlistItemToCandidate)

		const chosen = sampleWithReadyPreference(relatedCandidates, maxOrbitCards)

		if (chosen.length < maxOrbitCards) {
			const used = new Set([itemKey(center), ...chosen.map(itemKey)])
			const fallbackPool = recommendations.filter(item => !used.has(itemKey(item)))
			const fill = sampleWithReadyPreference(fallbackPool, maxOrbitCards - chosen.length)
			orbitItems = [...chosen, ...fill]
		} else {
			orbitItems = chosen
		}
	})

	const relatedRecommendations = $derived(orbitItems)

	// Shared fan-layout math, used both for the real orbit cards and for the
	// skeleton placeholders shown while the background is still loading —
	// keeping the two visually identical avoids any layout jump when the
	// skeletons are swapped for real cards.
	function computeOrbitPositions(count: number) {
		if (count === 0 || layoutTier === 'compact') return []

		const tier = layoutTier === 'wide'
			? { arcSpan: 64, radiusXBase: 235, radiusXBonus: 195, radiusYBase: 190, radiusYBonus: 90 }
			: { arcSpan: 70, radiusXBase: 250, radiusXBonus: 40, radiusYBase: 180, radiusYBonus: 40 }
		const rightCount = Math.ceil(count / 2)
		const leftCount = count - rightCount

		return Array.from({ length: count }, (_, index) => {
			const onRight = index % 2 === 0
			const groupIndex = Math.floor(index / 2)
			const groupCount = onRight ? rightCount : leftCount
			const t = groupCount > 1 ? groupIndex / (groupCount - 1) : 0.5
			const withinArc = (t - 0.5) * tier.arcSpan
			const depth = Math.abs(t - 0.5) * 2
			const angleDeg = onRight ? withinArc : 180 - withinArc
			const angle = angleDeg * (Math.PI / 180)
			const radiusX = tier.radiusXBase + depth * tier.radiusXBonus
			const radiusY = tier.radiusYBase + depth * tier.radiusYBonus
			const x = Math.cos(angle) * radiusX
			const y = Math.sin(angle) * radiusY
			// Mirror the tilt on the left side so cards lean away from the
			// center in both directions, like petals fanned around a circle.
			const rotate = onRight ? withinArc * 0.14 : -withinArc * 0.14
			const scale = 1 - depth * 0.06
			return { x, y, rotate, scale, delay: `${index * 0.08}s` }
		})
	}

	const orbitCards = $derived.by(() => {
		const items = relatedRecommendations
		return computeOrbitPositions(items.length).map((position, index) => ({ item: items[index], ...position }))
	})

	const orbitPlaceholders = $derived(computeOrbitPositions(maxOrbitCards))

	function moodHref(key: MoodKey) {
		return `/mood?s=${key}`
	}

	function formatYear(date: string | null | undefined) {
		if (!date) return '—'
		const year = new Date(date).getFullYear()
		return Number.isNaN(year) ? '—' : String(year)
	}

	function shuffle() {
		if (recommendations.length === 0) return

		// Prefer a title that isn't currently shown (as center or background);
		// only reuse one of those if there's truly nothing else left to pick.
		// The background then refreshes automatically to the new center's
		// related-and-on-watchlist neighborhood via the effect above.
		const shownKeys = new Set([activeItem ? itemKey(activeItem) : null, ...orbitItems.map(itemKey)])
		const hidden = recommendations.filter(item => !shownKeys.has(itemKey(item)))
		const otherItems = recommendations.filter(item => !activeItem || itemKey(item) !== itemKey(activeItem))
		const pool = sampleWithReadyPreference(hidden.length > 0 ? hidden : otherItems, 1)
		if (pool.length === 0) return

		activeItem = pool[0]
	}

	function moveSelection(item: MoodRecommendationCandidate) {
		if (!activeItem || itemKey(item) === itemKey(activeItem)) return
		activeItem = item
	}

	function openActivePreview() {
		if (!activeRecommendation) return
		openDetailPreview({ mediaType: activeRecommendation.mediaType, id: activeRecommendation.id, fromUrl: page.url })
	}

	function chipClass(selected = false) {
		return selected
			? 'border-amber-400/60 bg-amber-500/10 text-white'
			: 'border-white/10 bg-white/5 text-[color:var(--color-ink-200)]'
	}

	function orbitStyle(node: { x: number; y: number; rotate: number; scale: number; delay: string }) {
		return `--x: ${node.x}px; --y: ${node.y}px; --rotate: ${node.rotate}deg; --scale: ${node.scale}; --delay: ${node.delay};`
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!hasMood) return
		if (e.repeat) return
		if (isEditableTarget(e.target)) return
		if (e.code === 'Space') {
			e.preventDefault()
			shuffle()
		} else if (e.key === 'Enter') {
			e.preventDefault()
			openActivePreview()
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>{hasMood ? `CineList — ${activeMoodOption?.label ?? 'Mood Match'}` : 'CineList — Mood Match'}</title>
</svelte:head>

{#if !hasMood}
	<section class="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
		<div class="absolute inset-0" style="background: radial-gradient(circle at top left, rgba(245, 158, 11, 0.14), transparent 28%), radial-gradient(circle at bottom right, rgba(56, 189, 248, 0.12), transparent 34%), linear-gradient(180deg, var(--color-surface-800), var(--color-surface-950));"></div>
		<div class="absolute inset-0 pointer-events-none" style="background: radial-gradient(circle at 50% 15%, rgba(255,255,255,0.04), transparent 30%), radial-gradient(circle at 20% 80%, rgba(251,191,36,0.08), transparent 18%), radial-gradient(circle at 80% 70%, rgba(34,197,94,0.06), transparent 20%);"></div>

		<div class="relative mx-auto flex max-w-6xl items-center">
			<div class="w-full rounded-4xl border border-white/10 bg-black/25 p-6 shadow-2xl shadow-black/25 backdrop-blur-2xl sm:p-8 lg:p-10">
				<div class="max-w-3xl">
					<p class="text-sm font-semibold uppercase tracking-[0.22em]" style="color: var(--color-amber-500)">Cinelist Recommendations</p>
					<h1 class="mt-4 text-2xl font-semibold tracking-tight text-balance sm:text-3xl lg:text-4xl" style="color: var(--color-ink-50)">
						Find a Movie that Matches Your Mood
					</h1>
					<p class="mt-5 max-w-3xl text-md leading-8" style="color: var(--color-ink-300)">
						Pick a mood and CineList will suggest a movie that fits it, prioritizing titles you already own or have on your watchlist. You can shuffle through the recommendations until you find one that clicks.
					</p>
				</div>

				<div class="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
					{#each data.moodOptions as option}
						<a href={moodHref(option.key)} class="group rounded-3xl border border-white/10 bg-white/4 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-amber-400/40 hover:bg-white/[0.07] hover:shadow-xl hover:shadow-black/20">
							<div class="flex items-start justify-between gap-3">
								<div>
									<p class="text-lg font-semibold" style="color: var(--color-ink-50)">{option.label}</p>
									<p class="mt-1 text-sm leading-6" style="color: var(--color-ink-300)">{option.description}</p>
								</div>
								<span class="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/25 text-sm font-semibold text-amber-300 transition-transform duration-200 group-hover:scale-110">→</span>
							</div>
						</a>
					{/each}
				</div>
			</div>
		</div>
	</section>
{:else}
	<section class="relative min-h-screen overflow-hidden px-4 py-3 sm:px-6 lg:px-8">
		<div class="absolute inset-0" style="background: radial-gradient(circle at 50% 30%, rgba(251,191,36,0.12), transparent 28%), radial-gradient(circle at 20% 20%, rgba(56,189,248,0.08), transparent 22%), radial-gradient(circle at 80% 75%, rgba(244,114,182,0.08), transparent 24%), linear-gradient(180deg, var(--color-surface-800), var(--color-surface-950));"></div>
		<div class="absolute inset-0 pointer-events-none" style="background: linear-gradient(180deg, rgba(255,255,255,0.03), transparent 22%);"></div>

		<div class="relative mx-auto flex min-h-[calc(100vh-11rem)] max-w-7xl flex-col">
			{#snippet centerCardBody()}
				<div class="relative overflow-hidden rounded-t-4xl" style="height: min(40vh, 22rem);">
					<img src={posterUrl(activeRecommendation!.poster_path, 'w500')} alt={activeRecommendation!.title} class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
					<div class="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent"></div>
					<div class="absolute bottom-0 left-0 right-0 p-4">
						<p class="text-[10px] font-medium uppercase tracking-[0.22em]" style="color: var(--color-amber-300)">Recommendation</p>
						<h2 class="mt-1.5 text-lg font-semibold leading-tight text-balance text-white sm:text-xl">{activeRecommendation!.title}</h2>
						<div class="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-white/80">
							<span>{formatYear(activeRecommendation!.release_date)}</span>
							<span class="rounded-full border border-white/10 bg-white/10 px-2.5 py-1">★ {activeRecommendation!.vote_average.toFixed(1)}</span>
							{#if activeRecommendation!.onMediaServer}
								<span class="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">Ready in library</span>
							{/if}
						</div>
					</div>
				</div>
				<div class="space-y-2.5 p-4 pt-2">
					{#if overviewPending}
						<div class="space-y-1.5" aria-hidden="true">
							<div class="skeleton h-5 w-full"></div>
							<div class="skeleton h-5.5 w-4/5"></div>
						</div>
					{:else}
						<p class="text-sm leading-6 line-clamp-2" style="color: var(--color-ink-300)">{activeOverview || 'A strong fit for this mood, ready for the next watch decision.'}</p>
					{/if}
					<div class="flex flex-wrap gap-2">
						{#each activeRecommendation!.genre_ids.map(id => GENRE_NAMES[id]).filter(Boolean).slice(0, 4) as genreName}
							<span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style="color: var(--color-ink-300)">{genreName}</span>
						{/each}
					</div>
				</div>
			{/snippet}

			<div class="relative flex flex-1 items-center justify-center overflow-hidden rounded-4xl border border-white/10 bg-black/20 shadow-2xl shadow-black/25 backdrop-blur-xl">
				<div class="absolute inset-0 pointer-events-none" style="background: radial-gradient(circle at center, rgba(255,255,255,0.06), transparent 36%), radial-gradient(circle at center, rgba(251,191,36,0.12), transparent 58%);"></div>
				{#if activeRecommendation}
					{#if layoutTier === 'compact'}
						<div class="absolute inset-0 flex flex-col items-center gap-5 overflow-y-auto px-4 pt-6 pb-24 sm:pb-6" in:fade={{ duration: 220 }}>
							<button type="button" class="group relative shrink-0 overflow-hidden rounded-4xl border border-white/10 bg-black/55 text-left shadow-2xl shadow-black/30 transition-transform duration-300 hover:scale-[1.01] hover:border-amber-400/30" onclick={openActivePreview} style="width: min(88vw, 20rem);">
								{@render centerCardBody()}
							</button>

							{#if relatedPending}
								<div class="flex w-full max-w-full shrink-0 gap-3 overflow-x-auto px-1 pb-1" aria-hidden="true">
									{#each Array.from({ length: maxOrbitCards }) as _, index (index)}
										<div class="w-24 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/60 text-left shadow-lg shadow-black/25">
											<div class="skeleton aspect-4/5 rounded-none"></div>
											<div class="space-y-1 px-2 py-1.5">
												<div class="skeleton h-3 w-4/5"></div>
												<div class="skeleton h-2.5 w-2/5"></div>
											</div>
										</div>
									{/each}
								</div>
							{:else if relatedRecommendations.length > 0}
								<div class="flex w-full max-w-full shrink-0 gap-3 overflow-x-auto px-1 pb-1">
									{#each relatedRecommendations as item (`${item.mediaType}:${item.id}`)}
										<button
											type="button"
											class="group w-24 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/60 text-left shadow-lg shadow-black/25 transition-transform duration-200 hover:scale-[1.04] hover:border-amber-400/30"
											onclick={() => moveSelection(item)}
										>
											<div class="relative aspect-4/5 overflow-hidden">
												<img src={posterUrl(item.poster_path, 'w185')} alt={item.title} class="h-full w-full object-cover" />
											</div>
											<div class="space-y-0.5 px-2 py-1.5">
												<p class="truncate text-xs font-semibold" style="color: var(--color-ink-50)">{item.title}</p>
												<p class="text-[11px]" style="color: var(--color-ink-300)">{formatYear(item.release_date)} · ★ {item.vote_average.toFixed(1)}</p>
											</div>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{:else}
						<div class="canvas-stage absolute inset-0">
							<div class="center-node" in:fade={{ duration: 220 }}>
								<button type="button" class="center-card group relative overflow-hidden rounded-4xl border border-white/10 bg-black/55 text-left shadow-2xl shadow-black/30 transition-transform duration-300 hover:scale-[1.02] hover:border-amber-400/30" onclick={openActivePreview} style="width: min(72vw, 18rem);">
									{@render centerCardBody()}
								</button>
							</div>

							{#if relatedPending}
								{#each orbitPlaceholders as position, index (index)}
									<div class="orbit-node" style={orbitStyle(position)} aria-hidden="true">
										<div class="orbit-card overflow-hidden rounded-2xl border border-white/10 bg-black/60 shadow-2xl shadow-black/25">
											<div class="skeleton aspect-4/5 rounded-none"></div>
											<div class="space-y-1 px-2.5 py-2">
												<div class="skeleton h-3 w-4/5"></div>
												<div class="skeleton h-2.5 w-2/5"></div>
											</div>
										</div>
									</div>
								{/each}
							{:else}
								{#each orbitCards as card (`${card.item.mediaType}:${card.item.id}`)}
									<button
										type="button"
										class="orbit-node"
										style={orbitStyle(card)}
										onclick={() => moveSelection(card.item)}
									>
										<div class="orbit-card group overflow-hidden rounded-2xl border border-white/10 bg-black/60 shadow-2xl shadow-black/25 transition-transform duration-300 hover:scale-[1.04] hover:border-amber-400/30">
											<div class="relative aspect-4/5 overflow-hidden">
												<img src={posterUrl(card.item.poster_path, 'w185')} alt={card.item.title} class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
												<div class="absolute inset-0 bg-linear-to-t from-black/85 via-black/10 to-transparent"></div>
											</div>
											<div class="space-y-0.5 px-2.5 py-2 text-left">
												<p class="truncate text-xs font-semibold" style="color: var(--color-ink-50)">{card.item.title}</p>
												<p class="text-[11px]" style="color: var(--color-ink-300)">{formatYear(card.item.release_date)} · ★ {card.item.vote_average.toFixed(1)}</p>
											</div>
										</div>
									</button>
								{/each}
							{/if}
						</div>
					{/if}
				{:else}
					<div class="absolute inset-0 flex items-center justify-center p-6 text-center">
						<div class="max-w-md rounded-4xl border border-white/10 bg-black/45 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl">
							<h2 class="text-2xl font-semibold" style="color: var(--color-ink-50)">No recommendations yet</h2>
							<p class="mt-3 text-base leading-7" style="color: var(--color-ink-300)">
								Add a few titles to your watchlist, then pick another mood to start the canvas.
							</p>
						</div>
					</div>
				{/if}
			</div>
		</div>

		{#snippet kbdHint(label: string, amber = false)}
			<kbd
				class="hidden rounded-md border px-1.5 py-0.5 font-mono text-[10px] leading-none sm:inline-block"
				style={amber
					? 'border-color: color-mix(in srgb, var(--color-surface-950) 30%, transparent); background: color-mix(in srgb, var(--color-surface-950) 15%, transparent); color: var(--color-surface-950)'
					: 'border-color: color-mix(in srgb, var(--color-surface-600) 60%, transparent); background: color-mix(in srgb, var(--color-surface-950) 30%, transparent); color: var(--color-ink-300)'}
			>{label}</kbd>
		{/snippet}

		<div class="fixed bottom-4 left-1/2 z-50 w-[min(94vw,980px)] -translate-x-1/2 px-2">
			<div class="flex flex-col gap-2 rounded-3xl border border-white/10 bg-black/70 p-2 shadow-2xl shadow-black/35 backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between">
                <div class="flex items-center gap-2">
                    <details class="relative min-w-0" bind:this={moodMenu}>
                        <summary class="mood-bar-button flex cursor-pointer list-none items-center gap-2">
                            <svg viewBox="0 0 24 24" class="size-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <path d="M4 6h16" />
                                <path d="M7 12h10" />
                                <path d="M10 18h4" />
                            </svg>
                            <span class="truncate">
                                <span style="color: var(--color-amber-500)">{activeMoodOption?.label ?? 'Mood'}</span>
                                <span class="hidden sm:inline"> · Change mood</span>
                            </span>
                        </summary>
                        <div class="absolute bottom-full left-0 mb-3 rounded-3xl border border-white/10 bg-black/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-2xl" style="width: min(92vw, 42rem)">
                            <div class="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                                {#each data.moodOptions as option}
                                    <a href={moodHref(option.key)} onclick={closeMoodMenu} class={`rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition-colors ${chipClass(option.key === data.mood)}`}>
                                        <div class="flex items-center justify-between gap-2">
                                            <span>{option.label}</span>
                                        </div>
                                        <p class="mt-1 text-xs font-normal normal-case leading-5" style="color: var(--color-ink-300)">{option.description}</p>
                                    </a>
                                {/each}
                            </div>
                        </div>
                    </details>

					<button
						type="button"
						class="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium shadow-lg shadow-amber-500/20 transition-all duration-150 ease-spring hover:brightness-110 active:scale-95"
						aria-label="Shuffle recommendation"
						aria-keyshortcuts="Space"
						title="Shuffle (Space)"
						style="background: var(--color-amber-500); color: var(--color-surface-950)"
						onclick={shuffle}
						disabled={recommendations.length === 0}
					>
						<svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<path d="M16 3h5v5" />
							<path d="M4 20 19 5" />
							<path d="M21 16v5h-5" />
							<path d="M15 15l6 6" />
							<path d="M4 4l5 5" />
						</svg>
						Shuffle
						{@render kbdHint('space', true)}
					</button>

                    <!-- Divider: everything past this point affects the whole page, not just the centered movie -->
					<!-- <div class="mx-1 h-6 w-px shrink-0" style="background: color-mix(in srgb, var(--color-surface-600) 70%, transparent)"></div> -->

                </div>

				<div class="flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap px-1 sm:px-0">
					<button
						type="button"
						class="mood-bar-button"
						aria-label="Open details"
						aria-keyshortcuts="Enter"
						title="Open details (Enter)"
						onclick={openActivePreview}
						disabled={!activeRecommendation}
					>
						<svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<path d="M15 3h6v6" />
							<path d="M9 21H3v-6" />
							<path d="M21 3l-7 7" />
							<path d="M3 21l7-7" />
						</svg>
						<span class="hidden sm:inline">View Details</span>
						{@render kbdHint('enter')}
					</button>
                    <!-- Actions for the current center movie -->
					{#if activeRecommendation}
						<JellyfinPlayButton id={activeRecommendation.id} mediaType={activeRecommendation.mediaType} />
						{#if trailerPending}
							<div class="mood-bar-button !gap-[8.5px]" aria-hidden="true">
								<span class="skeleton size-5 rounded-full"></span>
								<span class="skeleton hidden h-3 w-12.5 sm:inline-block"></span>
							</div>
						{:else if activeTrailer}
							<TrailerButton trailer={activeTrailer} onclick={() => (showTrailer = true)} />
						{/if}
					{/if}
				</div>
			</div>
		</div>

		{#if showTrailer && activeTrailer}
			<TrailerModal trailer={activeTrailer} onclose={() => (showTrailer = false)} />
		{/if}
	</section>
{/if}

<style>
	/* Shared secondary-button look, matching TrailerButton/JellyfinPlayButton
	   so every non-primary action in the bar reads as one consistent family. */
	.mood-bar-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		flex-shrink: 0;
		font-weight: 500;
		font-size: 0.875rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.75rem;
		transition: all 150ms ease;
		background: color-mix(in srgb, var(--color-surface-700) 60%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-surface-600) 50%, transparent);
		color: var(--color-ink-100);
	}

	.mood-bar-button:hover:not(:disabled) {
		background: var(--color-surface-700);
	}

	.mood-bar-button:active:not(:disabled) {
		transform: scale(0.96);
	}

	.mood-bar-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.canvas-stage {
		overflow: visible;
	}

	.canvas-stage::before {
		content: '';
		position: absolute;
		inset: 50% auto auto 50%;
		width: 46rem;
		height: 46rem;
		transform: translate(-50%, -50%);
		border-radius: 9999px;
		background: radial-gradient(circle, rgba(251,191,36,0.08), transparent 58%);
		pointer-events: none;
	}

	.canvas-stage::after {
		content: '';
		position: absolute;
		inset: 50% auto auto 50%;
		width: 34rem;
		height: 34rem;
		transform: translate(-50%, -50%);
		border-radius: 9999px;
		background: radial-gradient(circle, rgba(56,189,248,0.07), transparent 62%);
		pointer-events: none;
	}

	.center-node {
		position: absolute;
		inset: 50% auto auto 50%;
		transform: translate(-50%, -50%);
		z-index: 10;
		animation: center-bob 7s ease-in-out infinite;
	}

	.center-node:hover {
		animation-play-state: paused;
	}

	.orbit-node {
		position: absolute;
		inset: 50% auto auto 50%;
		transform: translate(-50%, -50%) translate(var(--x), var(--y)) scale(var(--scale));
		z-index: 4;
	}

	.orbit-node:hover {
		z-index: 18;
	}

	.orbit-card {
		width: 7.5rem;
		animation: orbit-bob 8s ease-in-out infinite;
		animation-delay: var(--delay);
		transform: rotate(var(--rotate));
		transform-origin: center;
	}

	.orbit-node:hover .orbit-card {
		animation-play-state: paused;
		transform: rotate(var(--rotate)) scale(1.06);
	}

	@keyframes center-bob {
		0%, 100% {
			transform: translate(-50%, -50%) translateY(0);
		}
		50% {
			transform: translate(-50%, -50%) translateY(-10px);
		}
	}

	@keyframes orbit-bob {
		0%, 100% {
			transform: translateY(0) rotate(var(--rotate));
		}
		50% {
			transform: translateY(-8px) rotate(var(--rotate));
		}
	}

</style>
