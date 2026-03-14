<script lang="ts">
	import TVDetailView from '$components/detail/TVDetailView.svelte'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	const tv = $derived(data.tv)
	const related = $derived(data.related)
</script>

<svelte:head>
	<title>{tv.name} — CineList</title>
	<meta name="description" content={tv.overview} />
</svelte:head>


<TVDetailView {tv} {related} />
