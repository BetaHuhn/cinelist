<script lang="ts">
	import { onMount } from 'svelte'
	import TVDetailView from '$components/detail/TVDetailView.svelte'
	import { navHistory } from '$lib/stores/navigationHistory'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	const tv = $derived(data.tv)
	const related = $derived(data.related)
  const favoritePeopleByMedia = $derived(data.favoritePeopleByMedia)

	onMount(() => {
		navHistory.push({
			type: 'tv',
			id: tv.id,
			title: tv.name,
			posterPath: tv.poster_path,
			href: `/tv/${tv.id}`
		})
	})
</script>

<svelte:head>
	<title>{tv.name} — CineList</title>
	<meta name="description" content={tv.overview} />
</svelte:head>


<TVDetailView {tv} {related} {favoritePeopleByMedia} />
