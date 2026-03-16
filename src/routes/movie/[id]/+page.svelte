<script lang="ts">
	import MovieDetailView from '$components/detail/MovieDetailView.svelte'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	const movie = $derived(data.movie)
	const related = $derived(data.related)
	const favoritePeopleByMedia = $derived(data.favoritePeopleByMedia)
</script>

<svelte:head>
	<title>{movie.title} — CineList</title>
	<meta name="description" content={movie.overview} />
</svelte:head>


<MovieDetailView {movie} {related} {favoritePeopleByMedia} />
