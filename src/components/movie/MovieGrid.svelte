<script lang="ts">
	import type { TMDBMedia } from '$lib/types/tmdb'
	import MovieCard from './MovieCard.svelte'
	import MovieCardSkeleton from './MovieCardSkeleton.svelte'

	interface Props {
		movies?: TMDBMedia[]
		loading?: boolean
		skeletonCount?: number
	}

	let { movies = [], loading = false, skeletonCount = 12 }: Props = $props()
</script>

<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
	{#if loading}
		{#each Array(skeletonCount) as _, i (i)}
			<MovieCardSkeleton />
		{/each}
	{:else}
		{#each movies as movie, i ((('media_type' in movie ? movie.media_type : ('title' in movie ? 'movie' : 'tv')) + ':' + movie.id))}
			<MovieCard {movie} index={i} />
		{/each}
	{/if}
</div>
