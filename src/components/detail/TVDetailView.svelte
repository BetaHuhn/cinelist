<script lang="ts">
	import { fade } from 'svelte/transition'
	import DetailLayout from '$components/detail/DetailLayout.svelte'
	import { formatDate, formatRuntime } from '$lib/utils/format'
	import { posterUrl } from '$lib/utils/image'
	import RatingBadge from '$components/movie/RatingBadge.svelte'
	import MovieGrid from '$components/movie/MovieGrid.svelte'
	import PeopleGridSection from '$components/detail/PeopleGridSection.svelte'
	import WatchlistButton from '$components/watchlist/WatchlistButton.svelte'
	import JellyfinPlayButton from '$components/watchlist/JellyfinPlayButton.svelte'
	import GetButton from '$components/watchlist/GetButton.svelte'
	import TrailerButton from '$components/movie/TrailerButton.svelte'
	import TrailerModal from '$components/modals/TrailerModal.svelte'
	import Badge from '$components/ui/Badge.svelte'
	import ItemMoreMenu from '$components/detail/ItemMoreMenu.svelte'
	import { createDetailHotkeys, type WatchlistButtonHandle } from '$lib/utils/detailHotkeys'
	import { blacklist, filterBlacklisted } from '$lib/stores/blacklist'
	import type { TVDetail, FavoritePeopleByMedia } from '$lib/types/app'
	import type { TMDBMedia } from '$lib/types/tmdb'
	import UserRating from '$components/watchlist/UserRating.svelte'

	interface Props {
		tv: TVDetail
		related?: TMDBMedia[]
		favoritePeopleByMedia?: FavoritePeopleByMedia
	}

	let { tv, related = [], favoritePeopleByMedia }: Props = $props()
	let showTrailer = $state(false)
	let watchlistButton: WatchlistButtonHandle | null = null

	const hotkeys = createDetailHotkeys({
		getWatchlistButton: () => watchlistButton,
		getHasTrailer: () => Boolean(tv.trailer),
		toggleTrailer: () => {
			showTrailer = !showTrailer
		}
	})

	const crew = $derived(
		tv.credits.crew
			.filter(c => c.job === 'Director' || c.job === 'Producer' || c.job === 'Executive Producer' || c.job === 'Screenplay' || c.job === 'Writer' || c.job === 'Story')
			.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i)
	)

	const directors = $derived(
		tv.credits.crew
			.filter(c => c.job === 'Director')
			.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i)
	)
	const producers = $derived(
		tv.credits.crew
			.filter(c => c.job === 'Producer' || c.job === 'Executive Producer')
			.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i)
	)
	const runtime = $derived(tv.episode_run_time?.[0] ?? null)
	const seasons = $derived((tv.seasons ?? []).filter(s => s.season_number !== 0))
	const relatedItems = $derived(filterBlacklisted(related.filter(m => m.id !== tv.id), () => 'tv', $blacklist).slice(0, 12))
</script>

<svelte:window onkeydown={hotkeys.handleKeydown} onkeyup={hotkeys.handleKeyup} onblur={hotkeys.handleWindowBlur} />

{#if showTrailer && tv.trailer}
	<TrailerModal trailer={tv.trailer} onclose={() => (showTrailer = false)} />
{/if}

<article in:fade={{ duration: 250 }}>
	<DetailLayout title={tv.name} tagline={tv.tagline} posterPath={tv.poster_path} backdropPath={tv.backdrop_path} posterAlt={tv.name}>
		{#snippet header()}
			<!-- Meta -->
			<div class="flex flex-wrap items-center gap-2 text-sm" style="color: var(--color-ink-300)">
				{#if tv.certification}
					<Badge variant="default">{tv.certification}</Badge>
				{/if}
				<span>{formatDate(tv.first_air_date)}</span>
				{#if runtime}
					<span>·</span>
					<span>{formatRuntime(runtime)}</span>
				{/if}
				{#if tv.original_language && tv.original_language !== 'en'}
					<span>·</span>
					<span class="uppercase">{tv.original_language}</span>
				{/if}
			</div>
			{#if tv.genres && tv.genres.length > 0}
				<div class="flex flex-wrap gap-2 mt-2">
					{#each tv.genres as genre (genre.id)}
						<Badge variant="default">{genre.name}</Badge>
					{/each}
				</div>
			{/if}

			<!-- Ratings Row -->
			<div class="flex flex-wrap gap-3">
				{#if tv.ratings.tmdb}
					<RatingBadge label="TMDB" value={tv.ratings.tmdb.toFixed(1)} icon="⭐" />
				{/if}
			</div>

			<!-- User Rating -->
			<UserRating id={tv.id} mediaType="tv" />

			<!-- Actions -->
			<div class="flex items-center gap-3 flex-wrap">
				<WatchlistButton bind:this={watchlistButton} media={tv} size="lg" />
				<JellyfinPlayButton id={tv.id} mediaType="tv" />
				<GetButton id={tv.id} mediaType="tv" title={tv.name} releaseDate={tv.first_air_date} />
				{#if tv.trailer}
					<TrailerButton trailer={tv.trailer} onclick={() => (showTrailer = true)} />
				{/if}
				<ItemMoreMenu id={tv.id} mediaType="tv" title={tv.name} poster_path={tv.poster_path} />
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
		{#if tv.overview}
			<div class="mt-10">
				<h2 class="text-lg font-semibold mb-3" style="color: var(--color-ink-100)">Overview</h2>
				<p class="leading-relaxed" style="color: var(--color-ink-300)">{tv.overview}</p>
			</div>
		{/if}

		<!-- Seasons -->
		{#if seasons.length > 0}
			<div class="mt-10">
				<h2 class="text-lg font-semibold mb-4" style="color: var(--color-ink-100)">Seasons</h2>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					{#each seasons as season (season.id)}
						<a href="/tv/{tv.id}/season/{season.season_number}" class="flex gap-4 rounded-xl overflow-hidden hover:opacity-80 transition-opacity" style="background: var(--color-surface-800)">
							<!-- Poster -->
							<div class="w-20 shrink-0" style="background: var(--color-surface-700)">
								<img
									src={posterUrl(season.poster_path, 'w185')}
									alt={season.name}
									class="w-full h-full object-cover"
									loading="lazy"
								/>
							</div>

							<!-- Info -->
							<div class="flex-1 py-3 pr-3 flex flex-col gap-1 min-w-0">
								<div class="flex items-start justify-between gap-3">
									<div class="min-w-0">
										<p class="text-sm font-semibold leading-snug truncate" style="color: var(--color-ink-100)">{season.name}</p>
										<p class="text-xs mt-0.5" style="color: var(--color-ink-500)">
											Season {season.season_number}
											{#if season.air_date}
												· {formatDate(season.air_date)}
											{/if}
										</p>
									</div>
									<Badge variant="default">{season.episode_count} ep</Badge>
								</div>
								{#if season.overview}
									<p class="text-xs mt-1 line-clamp-2" style="color: var(--color-ink-300)">{season.overview}</p>
								{/if}
							</div>
						</a>
					{/each}
				</div>
			</div>
		{/if}

		<PeopleGridSection title="Cast" people={tv.credits.cast} subtitleKey="character" initialLimit={12} />
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
