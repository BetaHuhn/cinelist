<script lang="ts">
	import { fade } from 'svelte/transition'
	import { backdropUrl, posterUrl, profileUrl } from '$lib/utils/image'
	import { formatDate, formatRuntime } from '$lib/utils/format'
	import { fetchPersonExternalIds } from '$lib/api/tmdb'
	import RatingBadge from '$components/movie/RatingBadge.svelte'
	import MovieGrid from '$components/movie/MovieGrid.svelte'
	import WatchlistButton from '$components/watchlist/WatchlistButton.svelte'
	import TrailerButton from '$components/movie/TrailerButton.svelte'
	import TrailerModal from '$components/modals/TrailerModal.svelte'
	import Badge from '$components/ui/Badge.svelte'
	import type { TVDetail } from '$lib/types/app'
	import type { TMDBCastMember, TMDBMedia } from '$lib/types/tmdb'

	interface Props {
		tv: TVDetail
		related?: TMDBMedia[]
	}

	let { tv, related = [] }: Props = $props()
	let showTrailer = $state(false)

	const topCast = $derived(tv.credits.cast.slice(0, 12))
	const runtime = $derived(tv.episode_run_time?.[0] ?? null)
	const seasons = $derived((tv.seasons ?? []).filter(s => s.season_number !== 0))
	const relatedItems = $derived(related.filter(m => m.id !== tv.id).slice(0, 12))

	const personImdbCache = new Map<number, string | null>()

	async function openPersonOnImdb(member: TMDBCastMember) {
		if (typeof window === 'undefined') return

		// Open the tab synchronously to avoid popup blockers.
		const opened = window.open('about:blank', '_blank')
		if (!opened) return
		opened.opener = null

		let imdbId: string | null
		if (personImdbCache.has(member.id)) {
			imdbId = personImdbCache.get(member.id) ?? null
		} else {
			try {
				const externalIds = await fetchPersonExternalIds(member.id)
				imdbId = externalIds.imdb_id ?? null
				personImdbCache.set(member.id, imdbId)
			} catch {
				imdbId = null
				personImdbCache.set(member.id, null)
			}
		}

		const url = imdbId
			? `https://www.imdb.com/name/${imdbId}/`
			: `https://www.imdb.com/find/?q=${encodeURIComponent(member.name)}&s=nm`

		opened.location.href = url
	}
</script>

{#if showTrailer && tv.trailer}
	<TrailerModal trailer={tv.trailer} onclose={() => (showTrailer = false)} />
{/if}

<article in:fade={{ duration: 250 }}>
	<!-- Backdrop Hero -->
	<div class="relative h-[40vh] sm:h-[40vh] overflow-hidden" style="background: var(--color-surface-800)">
		{#if tv.backdrop_path}
			<img src={backdropUrl(tv.backdrop_path)} alt="" class="w-full h-full object-cover object-top opacity-60" />
		{/if}
		<div class="absolute inset-0" style="background: linear-gradient(to top, var(--color-surface-950) 0%, color-mix(in srgb, var(--color-surface-950) 40%, transparent) 50%, transparent 100%)"></div>
	</div>

	<!-- Content -->
	<div class="max-w-5xl mx-auto px-4 -mt-32 relative z-10 pb-16">
		<div class="flex flex-col sm:flex-row gap-8">
			<!-- Poster -->
			<div class="flex-shrink-0 mx-auto sm:mx-0">
				<img
					src={posterUrl(tv.poster_path, 'w500')}
					alt={tv.name}
					class="w-44 sm:w-56 rounded-2xl shadow-2xl"
					style="outline: 1px solid color-mix(in srgb, var(--color-surface-700) 50%, transparent)"
				/>
			</div>

			<!-- Info -->
			<div class="flex-1 flex flex-col gap-4 pt-2 sm:pt-8">
				<div>
					<h1 class="text-3xl sm:text-4xl font-bold leading-tight" style="color: var(--color-ink-50)">{tv.name}</h1>
					{#if tv.tagline}
						<p class="italic mt-1" style="color: var(--color-ink-500)">{tv.tagline}</p>
					{/if}
				</div>

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

				<!-- Actions -->
				<div class="flex items-center gap-3 flex-wrap">
					<WatchlistButton media={tv} size="lg" showLabel />
					{#if tv.trailer}
						<TrailerButton trailer={tv.trailer} onclick={() => (showTrailer = true)} />
					{/if}
				</div>
			</div>
		</div>

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
						<div class="flex gap-4 rounded-xl overflow-hidden" style="background: var(--color-surface-800)">
							<!-- Poster -->
							<div class="w-20 flex-shrink-0" style="background: var(--color-surface-700)">
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
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Cast -->
		{#if topCast.length > 0}
			<div class="mt-10">
				<h2 class="text-lg font-semibold mb-4" style="color: var(--color-ink-100)">Cast</h2>
				<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
					{#each topCast as member, i (member.id + '-' + i)}
						<button
							type="button"
							class="flex flex-col items-center text-center gap-2 bg-transparent border-0 p-0 appearance-none"
							aria-label={`Open ${member.name} on IMDb`}
							onclick={() => openPersonOnImdb(member)}
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
						</button>
					{/each}
				</div>
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
