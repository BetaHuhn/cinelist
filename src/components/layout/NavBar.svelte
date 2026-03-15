<script lang="ts">
	import { onMount } from 'svelte'
	import { page } from '$app/state'
	import { watchlist } from '$lib/stores/watchlist'
	import SearchBar from '$components/search/SearchBar.svelte'

	const navLinks = [
		{ href: '/', label: 'Discover' },
		{ href: '/library', label: 'Library' }
	]

	const currentPath = $derived(page.url.pathname)

	let isBrandCollapsed = $state(false)

	onMount(() => {
		const updateBrandState = () => {
			isBrandCollapsed = window.scrollY > 24
		}

		updateBrandState()
		window.addEventListener('scroll', updateBrandState, { passive: true })

		return () => {
			window.removeEventListener('scroll', updateBrandState)
		}
	})
</script>

<header class="sticky top-0 z-40 glass safe-top">
	<nav class="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
		<a
			href="/"
			class="brand-link relative z-30 flex items-center shrink-0"
			class:brand-link--collapsed={isBrandCollapsed}
			aria-label="CineList home"
		>
			<span class="brand-mark" aria-hidden="true">
				<svg class="brand-mark-full" viewBox="0 0 128 128" width="32" height="32" role="presentation">
					<circle class="brand-mark-circle" cx="64" cy="64" r="62" />
					<rect class="brand-mark-line" x="41" y="25" width="35" height="78" />
				</svg>
				<svg class="brand-mark-line-only" viewBox="0 0 128 128" width="32" height="32" role="presentation">
					<rect class="brand-mark-line" x="41" y="25" width="35" height="78" />
				</svg>
			</span>

			<span class="brand-wordmark font-bold text-xl tracking-tight" aria-hidden="true">
				<span style="color: var(--color-amber-500)">Cine</span><span style="color: var(--color-ink-50)">List</span>
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

<style>
	.brand-link {
		transition: gap 500ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.brand-mark {
		position: relative;
		width: 2rem;
		height: 2rem;
		flex: 0 0 2rem;
	}

	.brand-mark-full,
	.brand-mark-line-only {
		position: absolute;
		inset: 0;
		transition:
			opacity 500ms cubic-bezier(0.16, 1, 0.3, 1),
			transform 500ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.brand-mark-circle {
		fill: var(--color-surface-900);
	}

	.brand-mark-line {
		fill: var(--color-amber-500);
	}

	.brand-mark-line-only {
		opacity: 0;
		transform: scale(0.86);
	}

	.brand-wordmark {
		display: inline-block;
		white-space: nowrap;
		overflow: hidden;
		max-width: 9ch;
		opacity: 1;
		transform: translateX(0);
		transition:
			max-width 500ms cubic-bezier(0.16, 1, 0.3, 1),
			opacity 500ms cubic-bezier(0.16, 1, 0.3, 1),
			transform 500ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.brand-link--collapsed {
		gap: 0.25rem;
	}

	.brand-link--collapsed .brand-mark-full {
		opacity: 0;
		transform: scale(0.82);
	}

	.brand-link--collapsed .brand-mark-line-only {
		opacity: 1;
		transform: scale(1);
	}

	.brand-link--collapsed .brand-wordmark {
		max-width: 0;
		opacity: 0;
		transform: translateX(-0.35rem);
	}
</style>
