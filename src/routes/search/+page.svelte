<script lang="ts">
	import MovieGrid from '$components/movie/MovieGrid.svelte'
	import { profileUrl } from '$lib/utils/image'
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
		{#if data.results.length === 0 && (data.people?.length ?? 0) === 0}
			<p class="text-sm" style="color: var(--color-ink-400)">No results found.</p>
		{:else}
			{#if (data.people?.length ?? 0) > 0}
				<div class="mb-10">
					<h2 class="text-lg font-semibold mb-4" style="color: var(--color-ink-100)">People</h2>
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{#each data.people as person (person.id)}
							<a
								href={`/person/${person.id}`}
								class="flex items-center gap-4 rounded-xl p-4 card-hover"
								style="background: var(--color-surface-800); color: inherit"
							>
								<div class="size-12 rounded-full overflow-hidden flex-shrink-0" style="background: var(--color-surface-700)">
									<img src={profileUrl(person.profile_path, 'w185')} alt={person.name} class="w-full h-full object-cover" loading="lazy" />
								</div>
								<div class="min-w-0">
									<p class="text-sm font-semibold truncate" style="color: var(--color-ink-100)">{person.name}</p>
									{#if person.known_for_department}
										<p class="text-xs truncate" style="color: var(--color-ink-500)">{person.known_for_department}</p>
									{/if}
								</div>
							</a>
						{/each}
					</div>
				</div>
			{/if}

			{#if data.results.length > 0}
				<h2 class="text-lg font-semibold mb-4" style="color: var(--color-ink-100)">Movies & TV</h2>
				<MovieGrid movies={data.results} />
			{/if}
		{/if}
	{/if}
</section>
