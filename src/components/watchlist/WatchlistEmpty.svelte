<script lang="ts">
	import type { WatchlistStatus } from '$lib/types/app'

	interface Props {
		filter?: WatchlistStatus
	}
	let { filter = 'all' }: Props = $props()
</script>

<div class="flex flex-col items-center justify-center py-24 gap-4 text-center">
	<span class="text-6xl opacity-30">🎬</span>
	<h3 class="text-xl font-semibold" style="color: var(--color-ink-300)">
		{#if filter === 'ready'}
			Nothing ready to watch yet
		{:else if filter === 'pending'}
			Nothing waiting to be added
		{:else if filter === 'watched'}
			Nothing watched yet
		{:else}
			Your watchlist is empty
		{/if}
	</h3>
	<p class="text-sm max-w-xs" style="color: var(--color-ink-500)">
		{#if filter === 'all'}
			Browse trending movies and add them to your watchlist.
		{:else}
			Switch to the All tab to see your full library.
		{/if}
	</p>
	{#if filter === 'all'}
		<a href="/" class="btn-primary mt-2">Discover Movies</a>
	{/if}
</div>
