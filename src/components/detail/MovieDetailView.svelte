<script lang="ts">
	import { fade } from 'svelte/transition'
	import { backdropUrl, posterUrl, profileUrl } from '$lib/utils/image'
	import RatingBadge from '$components/movie/RatingBadge.svelte'
	import MovieMeta from '$components/movie/MovieMeta.svelte'
	import MovieGrid from '$components/movie/MovieGrid.svelte'
	import WatchlistButton from '$components/watchlist/WatchlistButton.svelte'
	import TrailerButton from '$components/movie/TrailerButton.svelte'
	import TrailerModal from '$components/modals/TrailerModal.svelte'
	import type { MovieDetail } from '$lib/types/app'
	import type { TMDBMedia } from '$lib/types/tmdb'

	interface Props {
		movie: MovieDetail
		related?: TMDBMedia[]
	}

	let { movie, related = [] }: Props = $props()
	let showTrailer = $state(false)

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
	const topCast = $derived(movie.credits.cast.slice(0, 12))
	const relatedItems = $derived(related.filter(m => m.id !== movie.id).slice(0, 12))
</script>

{#if showTrailer && movie.trailer}
	<TrailerModal trailer={movie.trailer} onclose={() => (showTrailer = false)} />
{/if}

<article in:fade={{ duration: 250 }}>
	<!-- Backdrop Hero -->
	<div class="relative h-[40vh] sm:h-[40vh] overflow-hidden" style="background: var(--color-surface-800)">
		{#if movie.backdrop_path}
			<img src={backdropUrl(movie.backdrop_path)} alt="" class="w-full h-full object-cover object-top opacity-60" />
		{/if}
		<div class="absolute inset-0" style="background: linear-gradient(to top, var(--color-surface-950) 0%, color-mix(in srgb, var(--color-surface-950) 40%, transparent) 50%, transparent 100%)"></div>
	</div>

	<!-- Content -->
	<div class="max-w-5xl mx-auto px-4 -mt-32 relative z-10 pb-16">
		<div class="flex flex-col sm:flex-row gap-8">
			<!-- Poster -->
			<div class="flex-shrink-0 mx-auto sm:mx-0">
				<img
					src={posterUrl(movie.poster_path, 'w500')}
					alt={movie.title}
					class="w-44 sm:w-56 rounded-2xl shadow-2xl"
					style="outline: 1px solid color-mix(in srgb, var(--color-surface-700) 50%, transparent)"
				/>
			</div>

			<!-- Info -->
			<div class="flex-1 flex flex-col gap-4 pt-2 sm:pt-8">
				<div>
					<h1 class="text-3xl sm:text-4xl font-bold leading-tight" style="color: var(--color-ink-50)">{movie.title}</h1>
					{#if movie.tagline}
						<p class="italic mt-1" style="color: var(--color-ink-500)">{movie.tagline}</p>
					{/if}
				</div>

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

				<!-- Actions -->
				<div class="flex items-center gap-3 flex-wrap">
					<WatchlistButton media={movie} size="lg" showLabel />
					{#if movie.trailer}
						<TrailerButton trailer={movie.trailer} onclick={() => (showTrailer = true)} />
					{/if}
				</div>

				{#if directors.length > 0}
					<p class="text-sm" style="color: var(--color-ink-500)">
						Directed by
						{#each directors.slice(0, 3) as d, i (d.id)}
							{#if i > 0}, {/if}
							<a
								href={`/person/${d.id}`}
								class="font-medium underline-offset-2 hover:underline"
								style="color: var(--color-ink-300)"
							>
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
							<a
								href={`/person/${p.id}`}
								class="font-medium underline-offset-2 hover:underline"
								style="color: var(--color-ink-300)"
							>
								{p.name}
							</a>
						{/each}
					</p>
				{/if}
			</div>
		</div>

		<!-- Overview -->
		{#if movie.overview}
			<div class="mt-10">
				<h2 class="text-lg font-semibold mb-3" style="color: var(--color-ink-100)">Overview</h2>
				<p class="leading-relaxed" style="color: var(--color-ink-300)">{movie.overview}</p>
			</div>
		{/if}

		<!-- Cast -->
		{#if topCast.length > 0}
			<div class="mt-10">
				<h2 class="text-lg font-semibold mb-4" style="color: var(--color-ink-100)">Cast</h2>
				<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
					{#each topCast as member, i (member.id + '-' + i)}
						<a
							href={`/person/${member.id}`}
							class="flex flex-col items-center text-center gap-2"
							style="color: inherit"
						>
							<div class="size-16 sm:size-20 rounded-full overflow-hidden flex-shrink-0" style="background: var(--color-surface-700)">
								<img
									src={profileUrl(member.profile_path)}
									alt={member.name}
									class="w-full h-full object-cover"
									loading="lazy"
								/>
							</div>
							<div>
								<p class="text-xs font-semibold leading-tight" style="color: var(--color-ink-100)">{member.name}</p>
								<p class="text-[11px] leading-tight mt-0.5 line-clamp-2" style="color: var(--color-ink-500)">{member.character}</p>
							</div>
						</a>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Directors / Producers -->
		{#if directors.length > 0 || producers.length > 0}
			<div class="mt-10">
				<h2 class="text-lg font-semibold mb-4" style="color: var(--color-ink-100)">Crew</h2>
				{#if directors.length > 0}
					<h3 class="text-sm font-semibold mb-3" style="color: var(--color-ink-300)">Directors</h3>
					<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
						{#each directors.slice(0, 12) as member, i (member.id + '-' + i)}
							<a href={`/person/${member.id}`} class="flex flex-col items-center text-center gap-2" style="color: inherit">
								<div class="size-16 sm:size-20 rounded-full overflow-hidden flex-shrink-0" style="background: var(--color-surface-700)">
									<img src={profileUrl(member.profile_path)} alt={member.name} class="w-full h-full object-cover" loading="lazy" />
								</div>
								<div>
									<p class="text-xs font-semibold leading-tight" style="color: var(--color-ink-100)">{member.name}</p>
									<p class="text-[11px] leading-tight mt-0.5 line-clamp-2" style="color: var(--color-ink-500)">{member.job}</p>
								</div>
							</a>
						{/each}
					</div>
				{/if}
				{#if producers.length > 0}
					<h3 class="text-sm font-semibold mb-3 mt-6" style="color: var(--color-ink-300)">Producers</h3>
					<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
						{#each producers.slice(0, 12) as member, i (member.id + '-' + i)}
							<a href={`/person/${member.id}`} class="flex flex-col items-center text-center gap-2" style="color: inherit">
								<div class="size-16 sm:size-20 rounded-full overflow-hidden flex-shrink-0" style="background: var(--color-surface-700)">
									<img src={profileUrl(member.profile_path)} alt={member.name} class="w-full h-full object-cover" loading="lazy" />
								</div>
								<div>
									<p class="text-xs font-semibold leading-tight" style="color: var(--color-ink-100)">{member.name}</p>
									<p class="text-[11px] leading-tight mt-0.5 line-clamp-2" style="color: var(--color-ink-500)">{member.job}</p>
								</div>
							</a>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Related -->
		{#if relatedItems.length > 0}
			<div class="mt-10">
				<h2 class="text-lg font-semibold mb-4" style="color: var(--color-ink-100)">Related</h2>
				<MovieGrid movies={relatedItems} />
			</div>
		{/if}
	</div>
</article>
