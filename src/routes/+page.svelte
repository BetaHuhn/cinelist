<script lang="ts">
	import { fade } from 'svelte/transition'
	import { onMount } from 'svelte'
	import MovieGrid from '$components/movie/MovieGrid.svelte'
	import SearchBar from '$components/search/SearchBar.svelte'
	import FeaturedCarousel from '$components/library/FeaturedCarousel.svelte'
	import { watchlist } from '$lib/stores/watchlist'
	import { blacklist, filterBlacklisted } from '$lib/stores/blacklist'
	import { openDiscover } from '$lib/stores/discover'
	import type { TMDBMedia } from '$lib/types/tmdb'
	import type { WatchlistItem } from '$lib/types/app'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	let previewCount = $state(12)

	function columnsForWidth(width: number): number {
		// Keep in sync with MovieGrid's responsive columns:
		// grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6
		if (width >= 1280) return 6
		if (width >= 1024) return 5
		if (width >= 768) return 4
		if (width >= 640) return 3
		return 2
	}

	function updatePreviewCount() {
		previewCount = columnsForWidth(window.innerWidth) * 2
	}

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

	function mediaType(media: TMDBMedia) {
		return 'title' in media ? 'movie' as const : 'tv' as const
	}

	const watchlistPreview = $derived.by(() =>
		$watchlist.filter(item => !item.watched && !item.onMediaServer).slice(0, previewCount).map(asMedia)
	)
	const libraryPreview = $derived.by(() =>
		$watchlist.filter(item => !item.watched && item.onMediaServer).slice(0, previewCount).map(asMedia)
	)

	const trending = $derived(filterBlacklisted(data.trending ?? [], mediaType, $blacklist))
	const recommended = $derived(filterBlacklisted(data.recommended ?? [], mediaType, $blacklist))
  const newlyReleased = $derived(filterBlacklisted(data.newlyReleased ?? [], mediaType, $blacklist))

	onMount(() => {
		updatePreviewCount()
		window.addEventListener('resize', updatePreviewCount)
		return () => window.removeEventListener('resize', updatePreviewCount)
	})
</script>

<svelte:head>
	<title>CineList — Discover</title>
</svelte:head>

<!-- Hero Section -->
<section class="relative px-4 py-16 sm:py-24 text-center" style="background: linear-gradient(to bottom, var(--color-surface-800), var(--color-surface-950))">
	<!-- Ambient glow (overflow-hidden scoped here so the search dropdown isn't clipped) -->
	<div class="absolute inset-0 pointer-events-none overflow-hidden" style="background: radial-gradient(ellipse at top, color-mix(in srgb, var(--color-amber-500) 8%, transparent) 0%, transparent 70%)"></div>

	<div class="relative max-w-2xl mx-auto flex flex-col gap-6" in:fade={{ duration: 300 }}>
		<h1 class="text-4xl sm:text-5xl font-bold tracking-tight" style="color: var(--color-ink-50)">
			Your Personal<br />
			<span style="color: var(--color-amber-500)">Watchlist</span>
		</h1>
		<p class="text-lg max-w-md mx-auto" style="color: var(--color-ink-300)">
			Discover trending movies and series, track what to watch, and know what's ready in your own library.
		</p>
		<div class="max-w-md mx-auto w-full">
			<SearchBar placeholder="Search for movies, TV & people…" />
		</div>
		<div class="flex justify-center">
			<button
				class="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-150 active:scale-95"
				style="background: var(--color-amber-500); color: var(--color-surface-950)"
				onclick={openDiscover}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M16 8h.01"/><path d="M8 8h.01"/><path d="M8 16h.01"/><path d="M16 16h.01"/><path d="M12 12h.01"/></svg>
				Feeling Lucky
			</button>
		</div>
	</div>
</section>

{#if data.featured?.length > 0}
	<section class="max-w-7xl mx-auto px-4 py-10">
		<FeaturedCarousel items={data.featured} />
	</section>
{/if}

{#if recommended?.length > 0}
	<!-- Personalized Recommendations Section -->
	<section class="max-w-7xl mx-auto px-4 py-10">
		<div class="mb-6">
			<h2 class="text-xl font-bold mb-2" style="color: var(--color-ink-50)">Recommended for You</h2>
			<p class="text-sm mb-4" style="color: var(--color-ink-300)">Based on your watchlist and ratings</p>
		</div>
		<MovieGrid movies={recommended} favoritePeopleByMedia={data.favoritePeopleByMedia} />
	</section>
{/if}

<!-- Trending Section -->
<section class="max-w-7xl mx-auto px-4 py-10">
	<div class="mb-6">
		<h2 class="text-xl font-bold mb-2" style="color: var(--color-ink-50)">Trending Now</h2>
		<p class="text-sm mb-4" style="color: var(--color-ink-300)">What's popular this week</p>
	</div>
	<MovieGrid movies={trending} favoritePeopleByMedia={data.favoritePeopleByMedia} />
</section>

{#if newlyReleased?.length > 0}
	<!-- Newly Released Section -->
	<section class="max-w-7xl mx-auto px-4 py-10">
		<div class="mb-6">
			<h2 class="text-xl font-bold mb-2" style="color: var(--color-ink-50)">Newly Released</h2>
			<p class="text-sm mb-4" style="color: var(--color-ink-300)">Recent releases from the past 3 months</p>
		</div>
		<MovieGrid movies={newlyReleased} favoritePeopleByMedia={data.favoritePeopleByMedia} />
	</section>
{/if}

{#if watchlistPreview.length > 0}
	<!-- Watchlist Preview Section -->
	<section class="max-w-7xl mx-auto px-4 py-10">
		<h2 class="text-xl font-bold mb-6" style="color: var(--color-ink-50)">From Your Watchlist</h2>
		<MovieGrid movies={watchlistPreview} />
	</section>
{/if}

{#if libraryPreview.length > 0}
	<!-- Library Preview Section -->
	<section class="max-w-7xl mx-auto px-4 py-10">
		<h2 class="text-xl font-bold mb-6" style="color: var(--color-ink-50)">Ready in Your Library</h2>
		<MovieGrid movies={libraryPreview} />
	</section>
{/if}
