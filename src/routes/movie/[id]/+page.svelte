<script lang="ts">
	import { onMount } from 'svelte'
	import MovieDetailView from '$components/detail/MovieDetailView.svelte'
	import { navHistory } from '$lib/stores/navigationHistory'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	const movie = $derived(data.movie)
	const related = $derived(data.related)
  const favoritePeopleByMedia = $derived(data.favoritePeopleByMedia)

	onMount(() => {
		navHistory.push({
			type: 'movie',
			id: movie.id,
			title: movie.title,
			posterPath: movie.poster_path,
			href: `/movie/${movie.id}`
		})
	})
</script>

<svelte:head>
	<title>{movie.title} — CineList</title>
	<meta name="description" content={movie.overview} />
</svelte:head>


<MovieDetailView {movie} {related} {favoritePeopleByMedia} />
