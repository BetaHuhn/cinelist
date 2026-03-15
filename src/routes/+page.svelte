<script lang="ts">
	import { fade } from 'svelte/transition'
	import { onMount } from 'svelte'
	import MovieGrid from '$components/movie/MovieGrid.svelte'
	import SearchBar from '$components/search/SearchBar.svelte'
	import FeaturedCarousel from '$components/library/FeaturedCarousel.svelte'
	import { watchlist } from '$lib/stores/watchlist'
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

	const watchlistPreview = $derived.by(() =>
		$watchlist.filter(item => !item.watched && !item.onMediaServer).slice(0, previewCount).map(asMedia)
	)
	const libraryPreview = $derived.by(() =>
		$watchlist.filter(item => !item.watched && item.onMediaServer).slice(0, previewCount).map(asMedia)
	)

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
	</div>
</section>

{#if data.featured?.length > 0}
	<section class="max-w-7xl mx-auto px-4 py-10">
		<FeaturedCarousel items={data.featured} />
	</section>
{/if}

{#if data.recommended?.length > 0}
	<!-- Personalized Recommendations Section -->
	<section class="max-w-7xl mx-auto px-4 py-10">
		<div class="mb-6">
			<h2 class="text-xl font-bold mb-2" style="color: var(--color-ink-50)">Recommended for You</h2>
			<p class="text-sm mb-4" style="color: var(--color-ink-300)">Based on your watchlist and ratings</p>
		</div>
		<MovieGrid movies={data.recommended} favoritePeopleByMedia={data.favoritePeopleByMedia} />
	</section>
{/if}

<!-- Trending Section -->
<section class="max-w-7xl mx-auto px-4 py-10">
	<div class="mb-6">
		<h2 class="text-xl font-bold mb-2" style="color: var(--color-ink-50)">Trending Now</h2>
		<p class="text-sm mb-4" style="color: var(--color-ink-300)">What's popular this week</p>
	</div>
	<MovieGrid movies={data.trending} favoritePeopleByMedia={data.favoritePeopleByMedia} />
</section>

{#if data.newlyReleased?.length > 0}
	<!-- Newly Released Section -->
	<section class="max-w-7xl mx-auto px-4 py-10">
		<div class="mb-6">
			<h2 class="text-xl font-bold mb-2" style="color: var(--color-ink-50)">Newly Released</h2>
			<p class="text-sm mb-4" style="color: var(--color-ink-300)">Recent releases from the past 3 months</p>
		</div>
		<MovieGrid movies={data.newlyReleased} favoritePeopleByMedia={data.favoritePeopleByMedia} />
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
