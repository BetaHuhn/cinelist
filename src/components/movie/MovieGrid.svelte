<script lang="ts">
	import type { TMDBMedia } from '$lib/types/tmdb'
	import type { FavoritePeopleByMedia } from '$lib/types/app'
	import MovieCard from './MovieCard.svelte'
	import MovieCardSkeleton from './MovieCardSkeleton.svelte'

	interface Props {
		movies?: TMDBMedia[]
		loading?: boolean
		skeletonCount?: number
		favoritePeopleByMedia?: FavoritePeopleByMedia
		jellyfinUrl?: string
		hideStateIndicators?: boolean
	}

	let { movies = [], loading = false, skeletonCount = 12, favoritePeopleByMedia, jellyfinUrl, hideStateIndicators = false }: Props = $props()

	function mediaKey(movie: TMDBMedia): string {
		const mt = 'media_type' in movie ? movie.media_type : ('title' in movie ? 'movie' : 'tv')
		return `${mt}:${movie.id}`
	}
</script>

<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
	{#if loading}
		{#each Array(skeletonCount) as _, i (i)}
			<MovieCardSkeleton />
		{/each}
	{:else}
		{#each movies as movie, i ((('media_type' in movie ? movie.media_type : ('title' in movie ? 'movie' : 'tv')) + ':' + movie.id))}
			<MovieCard {movie} index={i} favoritePeople={favoritePeopleByMedia?.[mediaKey(movie)]} {jellyfinUrl} hideState={hideStateIndicators} />
		{/each}
	{/if}
</div>
