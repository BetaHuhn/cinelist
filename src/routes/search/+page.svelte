<script lang="ts">
	import MovieGrid from '$components/movie/MovieGrid.svelte'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()
</script>

<svelte:head>
	<title>{data.q ? `Search: ${data.q} — CineList` : 'Search — CineList'}</title>
</svelte:head>

<section class="max-w-7xl mx-auto px-4 py-10">
	<div class="flex flex-col gap-2 mb-6">
		<h1 class="text-2xl font-bold" style="color: var(--color-ink-50)">Search</h1>
		{#if !data.q}
			<p class="text-sm" style="color: var(--color-ink-400)">
				Type a query in the search bar and press Enter.
			</p>
		{:else}
			<p class="text-sm" style="color: var(--color-ink-400)">
				Results for <span class="font-semibold" style="color: var(--color-ink-100)">“{data.q}”</span>
			</p>
		{/if}
	</div>

	{#if data.q}
		{#if data.results.length === 0}
			<p class="text-sm" style="color: var(--color-ink-400)">No results found.</p>
		{:else}
			<MovieGrid movies={data.results} />
		{/if}
	{/if}
</section>
