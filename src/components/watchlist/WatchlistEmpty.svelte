<script lang="ts">
	interface Props {
		filter?: string
	}
	let { filter = 'all' }: Props = $props()
</script>

<div class="flex flex-col items-center justify-center py-24 gap-4 text-center">
	<span class="text-6xl opacity-30">🎬</span>
	<h3 class="text-xl font-semibold" style="color: var(--color-ink-300)">
		{#if filter === 'on-server'}
			Nothing on your media server yet
		{:else if filter === 'pending'}
			Nothing pending — you're all caught up!
		{:else}
			Your watchlist is empty
		{/if}
	</h3>
	<p class="text-sm max-w-xs" style="color: var(--color-ink-500)">
		{#if filter === 'all'}
			Browse trending movies and add them to your watchlist.
		{:else}
			Switch to the All tab to see your full watchlist.
		{/if}
	</p>
	{#if filter === 'all'}
		<a href="/" class="btn-primary mt-2">Discover Movies</a>
	{/if}
</div>
