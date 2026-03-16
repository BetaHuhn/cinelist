<script lang="ts">
	import { fade } from 'svelte/transition'
	import { formatDate, formatRuntime } from '$lib/utils/format'
	import { posterUrl } from '$lib/utils/image'
	import Badge from '$components/ui/Badge.svelte'
	import PeopleGridSection from '$components/detail/PeopleGridSection.svelte'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	const season = $derived(data.season)
	const tvId = $derived(data.tvId)
	const tvName = $derived(data.tvName)
	const episodes = $derived(season.episodes ?? [])
	const cast = $derived(season.credits?.cast ?? [])
	const crew = $derived(
		(season.credits?.crew ?? [])
			.filter(c => c.job === 'Director' || c.job === 'Producer' || c.job === 'Executive Producer' || c.job === 'Screenplay' || c.job === 'Writer' || c.job === 'Story')
			.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i)
	)
</script>

<svelte:head>
	<title>{season.name} — {tvName} — CineList</title>
	<meta name="description" content={season.overview || `${season.name} of ${tvName}`} />
</svelte:head>

<section class="max-w-5xl mx-auto px-6 py-10" in:fade={{ duration: 200 }}>
	<!-- Back link -->
	<a
		href="/tv/{tvId}"
		class="inline-flex items-center gap-1.5 text-sm mb-8 hover:underline underline-offset-2"
		style="color: var(--color-ink-400)"
	>
		← {tvName}
	</a>

	<!-- Season header -->
	<div class="flex flex-col sm:flex-row gap-6 items-start">
		<div class="shrink-0">
			<img
				src={posterUrl(season.poster_path, 'w342')}
				alt={season.name}
				class="w-36 sm:w-44 rounded-2xl shadow-xl"
				style="outline: 1px solid color-mix(in srgb, var(--color-surface-700) 50%, transparent)"
			/>
		</div>

		<div class="flex-1 min-w-0">
			<h1 class="text-3xl sm:text-4xl font-bold leading-tight" style="color: var(--color-ink-50)">
				{season.name}
			</h1>
			<p class="text-sm mt-2" style="color: var(--color-ink-500)">
				Season {season.season_number}
				{#if season.air_date}
					· {formatDate(season.air_date)}
				{/if}
				· <Badge variant="default">{episodes.length} episodes</Badge>
			</p>
			{#if season.overview}
				<p class="mt-4 leading-relaxed text-sm" style="color: var(--color-ink-300)">{season.overview}</p>
			{/if}
		</div>
	</div>

	<!-- Episodes -->
	{#if episodes.length > 0}
		<div class="mt-10">
			<h2 class="text-lg font-semibold mb-4" style="color: var(--color-ink-100)">Episodes</h2>
			<div class="flex flex-col gap-4">
				{#each episodes as episode (episode.id)}
					<div class="flex gap-4 rounded-xl overflow-hidden" style="background: var(--color-surface-800)">
						<!-- Still image -->
						<div class="w-32 sm:w-44 shrink-0" style="background: var(--color-surface-700)">
							<img
								src={episode.still_path ? `https://image.tmdb.org/t/p/w300${episode.still_path}` : '/placeholder-poster.svg'}
								alt={episode.name}
								class="w-full h-full object-cover aspect-video"
								loading="lazy"
							/>
						</div>

						<!-- Info -->
						<div class="flex-1 py-3 pr-3 flex flex-col gap-1 min-w-0">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<p class="text-sm font-semibold leading-snug" style="color: var(--color-ink-100)">
										{episode.episode_number}. {episode.name}
									</p>
									<p class="text-xs mt-0.5" style="color: var(--color-ink-500)">
										{#if episode.air_date}
											{formatDate(episode.air_date)}
										{/if}
										{#if episode.runtime}
											{#if episode.air_date} · {/if}
											{formatRuntime(episode.runtime)}
										{/if}
									</p>
								</div>
								{#if episode.vote_average > 0}
									<span class="text-xs shrink-0 mt-0.5" style="color: var(--color-ink-400)">
										⭐ {episode.vote_average.toFixed(1)}
									</span>
								{/if}
							</div>
							{#if episode.overview}
								<p class="text-xs mt-1 line-clamp-3" style="color: var(--color-ink-300)">{episode.overview}</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<PeopleGridSection title="Cast" people={cast} subtitleKey="character" initialLimit={12} />
	<PeopleGridSection title="Crew" people={crew} subtitleKey="job" initialLimit={6} />
</section>
