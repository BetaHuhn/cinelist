<script lang="ts">
	import { fade } from 'svelte/transition'
	import DetailLayout from '$components/detail/DetailLayout.svelte'
	import RatingBadge from '$components/movie/RatingBadge.svelte'
	import MovieMeta from '$components/movie/MovieMeta.svelte'
	import MovieGrid from '$components/movie/MovieGrid.svelte'
	import PeopleGridSection from '$components/detail/PeopleGridSection.svelte'
	import WatchlistButton from '$components/watchlist/WatchlistButton.svelte'
	import TrailerButton from '$components/movie/TrailerButton.svelte'
	import TrailerModal from '$components/modals/TrailerModal.svelte'
	import MoreMenu from '$components/detail/MoreMenu.svelte'
	import { createDetailHotkeys, type WatchlistButtonHandle } from '$lib/utils/detailHotkeys'
	import { blacklist, filterBlacklisted } from '$lib/stores/blacklist'
	import type { MovieDetail, FavoritePeopleByMedia } from '$lib/types/app'
	import type { TMDBMedia } from '$lib/types/tmdb'
	import UserRating from '$components/watchlist/UserRating.svelte'

	interface Props {
		movie: MovieDetail
		related?: TMDBMedia[]
		favoritePeopleByMedia?: FavoritePeopleByMedia
	}

	let { movie, related = [], favoritePeopleByMedia }: Props = $props()
	let showTrailer = $state(false)
	let watchlistButton: WatchlistButtonHandle | null = null

	const hotkeys = createDetailHotkeys({
		getWatchlistButton: () => watchlistButton,
		getHasTrailer: () => Boolean(movie.trailer),
		toggleTrailer: () => {
			showTrailer = !showTrailer
		}
	})

	const crew = $derived(
		movie.credits.crew
			.filter(c => c.job === 'Director' || c.job === 'Producer' || c.job === 'Executive Producer' || c.job === 'Screenplay' || c.job === 'Writer' || c.job === 'Story')
			.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i)
	)

	const directors = $derived(
		movie.credits.crew
			.filter(c => c.job === 'Director')
			.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i)
	)
	const producers = $derived(
		movie.credits.crew
			.filter(c => c.job === 'Producer' || c.job === 'Executive Producer')
			.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i)
	)
	const relatedItems = $derived(filterBlacklisted(related.filter(m => m.id !== movie.id), () => 'movie', $blacklist).slice(0, 12))
</script>

<svelte:window onkeydown={hotkeys.handleKeydown} onkeyup={hotkeys.handleKeyup} onblur={hotkeys.handleWindowBlur} />

{#if showTrailer && movie.trailer}
	<TrailerModal trailer={movie.trailer} onclose={() => (showTrailer = false)} />
{/if}

<article in:fade={{ duration: 250 }}>
	<DetailLayout title={movie.title} tagline={movie.tagline} posterPath={movie.poster_path} backdropPath={movie.backdrop_path} posterAlt={movie.title}>
		{#snippet header()}
			<MovieMeta {movie} />

			<!-- Ratings Row -->
			<div class="flex flex-wrap gap-3">
				{#if movie.ratings.tmdb}
					<RatingBadge label="TMDB" value={movie.ratings.tmdb.toFixed(1)} icon="⭐" />
				{/if}
				{#if movie.ratings.rottenTomatoes}
					<RatingBadge label="Tomatometer" value={movie.ratings.rottenTomatoes} icon="🍅" />
				{/if}
				{#if movie.ratings.metacritic}
					<RatingBadge label="Metacritic" value={movie.ratings.metacritic} icon="🎯" />
				{/if}
			</div>

			<!-- User Rating -->
			<UserRating id={movie.id} mediaType="movie" />

			<!-- Actions -->
			<div class="flex items-center gap-3 flex-wrap">
				<WatchlistButton bind:this={watchlistButton} media={movie} size="lg" />
				{#if movie.trailer}
					<TrailerButton trailer={movie.trailer} onclick={() => (showTrailer = true)} />
				{/if}
				<MoreMenu id={movie.id} mediaType="movie" title={movie.title} poster_path={movie.poster_path} />
			</div>

			{#if directors.length > 0}
				<p class="text-sm" style="color: var(--color-ink-500)">
					Directed by
					{#each directors.slice(0, 3) as d, i (d.id)}
						{#if i > 0}, {/if}
						<a href={`/person/${d.id}`} class="font-medium underline-offset-2 hover:underline" style="color: var(--color-ink-300)">
							{d.name}
						</a>
					{/each}
				</p>
			{/if}
			{#if producers.length > 0}
				<p class="text-sm" style="color: var(--color-ink-500)">
					Produced by
					{#each producers.slice(0, 3) as p, i (p.id)}
						{#if i > 0}, {/if}
						<a href={`/person/${p.id}`} class="font-medium underline-offset-2 hover:underline" style="color: var(--color-ink-300)">
							{p.name}
						</a>
					{/each}
				</p>
			{/if}
		{/snippet}

		<!-- Overview -->
		{#if movie.overview}
			<div class="mt-10">
				<h2 class="text-lg font-semibold mb-3" style="color: var(--color-ink-100)">Overview</h2>
				<p class="leading-relaxed" style="color: var(--color-ink-300)">{movie.overview}</p>
			</div>
		{/if}

		<PeopleGridSection title="Cast" people={movie.credits.cast} subtitleKey="character" initialLimit={12} />
		<PeopleGridSection title="Crew" people={crew} subtitleKey="job" initialLimit={6} />

		<!-- Related -->
		{#if relatedItems.length > 0}
			<div class="mt-10">
				<h2 class="text-lg font-semibold mb-4" style="color: var(--color-ink-100)">Related</h2>
				<MovieGrid movies={relatedItems} {favoritePeopleByMedia} />
			</div>
		{/if}
	</DetailLayout>
</article>
