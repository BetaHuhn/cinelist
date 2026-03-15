<script lang="ts">
	import { page } from '$app/state'
	import { watchlist } from '$lib/stores/watchlist'
	import SearchBar from '$components/search/SearchBar.svelte'

	const navLinks = [
		{ href: '/', label: 'Discover' },
		{ href: '/library', label: 'Library' }
	]

	const currentPath = $derived(page.url.pathname)
</script>

<header class="sticky top-0 z-40 glass safe-top">
	<nav class="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
		<a href="/" class="relative z-30 flex items-center gap-2 flex-shrink-0">
			<span class="font-bold text-xl tracking-tight" style="color: var(--color-amber-500)">
				Cine<span style="color: var(--color-ink-50)">List</span>
			</span>
		</a>

		<div class="flex-1 max-w-sm hidden sm:block">
			<SearchBar resetOnLeaveSearch />
		</div>

		<div class="relative z-30 ml-auto flex items-center gap-1">
			{#each navLinks as link (link.href)}
				<a
					href={link.href}
					class="relative px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
					style={currentPath === link.href
						? 'color: var(--color-ink-50); background: var(--color-surface-700)'
						: 'color: var(--color-ink-500)'}
				>
					{link.label}
				</a>
			{/each}
		</div>
	</nav>

	<!-- Mobile search -->
	<div class="sm:hidden px-4 pb-3">
		<SearchBar resetOnLeaveSearch />
	</div>
</header>
