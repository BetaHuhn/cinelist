<script lang="ts">
	import { page } from '$app/state'
	import { watchlist } from '$lib/stores/watchlist'

	const currentPath = $derived(page.url.pathname)
	const count = $derived($watchlist.length)
</script>

<nav class="sm:hidden fixed bottom-0 left-0 right-0 z-40 glass safe-bottom" style="border-top: 1px solid color-mix(in srgb, var(--color-surface-700) 50%, transparent)">
	<div class="flex">
		<a
			href="/"
			class="flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors"
			style={currentPath === '/' ? 'color: var(--color-amber-500)' : 'color: var(--color-ink-500)'}
		>
			<svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
			</svg>
			Discover
		</a>

		<a
			href="/watchlist"
			class="flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors relative"
			style={currentPath === '/watchlist' ? 'color: var(--color-amber-500)' : 'color: var(--color-ink-500)'}
		>
			{#if count > 0}
				<span class="absolute top-2 right-1/2 translate-x-3 -translate-y-1 size-4 flex items-center justify-center text-[10px] font-bold rounded-full" style="background: var(--color-amber-500); color: var(--color-surface-950)">
					{count > 99 ? '99+' : count}
				</span>
			{/if}
			<svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
			</svg>
			Watchlist
		</a>
	</div>
</nav>
