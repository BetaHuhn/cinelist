<script lang="ts">
	import { page } from '$app/state'
	import { fly } from 'svelte/transition'
	import { navHistory, type NavEntry } from '$lib/stores/navigationHistory'
	import { posterUrl, profileUrl } from '$lib/utils/image'

	const entries = $derived($navHistory)
	const currentPath = $derived(page.url.pathname)

	// Whether the middle entries are hidden (collapsed)
	let expanded = $state(false)

	// Collapse whenever the user navigates to a different page
	$effect(() => {
		void currentPath
		expanded = false
	})

	// Collapse when > 3 entries and user hasn't expanded
	const isCollapsed = $derived(entries.length > 3 && !expanded)

	let trailEl: HTMLElement | undefined = $state()

	// Collapse on click-outside when expanded
	$effect(() => {
		if (!expanded || !trailEl) return

		function handleClickOutside(event: MouseEvent) {
			if (!trailEl?.contains(event.target as Node)) {
				expanded = false
			}
		}

		document.addEventListener('click', handleClickOutside, true)
		return () => document.removeEventListener('click', handleClickOutside, true)
	})

	function thumbSrc(entry: NavEntry): string {
		if (entry.type === 'person') return profileUrl(entry.posterPath, 'w45')
		return posterUrl(entry.posterPath, 'w92')
	}

	function isActive(entry: NavEntry): boolean {
		return currentPath === entry.href
	}
</script>

{#if entries.length >= 2}
	<div class="trail-wrap" bind:this={trailEl} transition:fly={{ y: -6, duration: 180 }}>
		<div class="trail-inner">
			{#if isCollapsed}
				<!-- Origin -->
				<a
					href={entries[0].href}
					class="trail-item"
					class:trail-item--active={isActive(entries[0])}
					title={entries[0].title}
				>
					<img
						src={thumbSrc(entries[0])}
						alt={entries[0].title}
						class="trail-thumb"
						class:trail-thumb--round={entries[0].type === 'person'}
					/>
					<span class="trail-label">{entries[0].title}</span>
				</a>

				<span class="trail-sep" aria-hidden="true">›</span>

				<!-- Expand button (3 dots) -->
				<button
					class="trail-expand"
					onclick={() => (expanded = true)}
					aria-label={`Show full navigation trail (${entries.length - 2} hidden)`}
					title="Expand trail"
				>
					···
				</button>

				<span class="trail-sep" aria-hidden="true">›</span>

				<!-- Current (last) entry -->
				{@const last = entries[entries.length - 1]}
				<a
					href={last.href}
					class="trail-item"
					class:trail-item--active={isActive(last)}
					title={last.title}
				>
					<img
						src={thumbSrc(last)}
						alt={last.title}
						class="trail-thumb"
						class:trail-thumb--round={last.type === 'person'}
					/>
					<span class="trail-label">{last.title}</span>
				</a>
			{:else}
				<!-- Full trail -->
				{#each entries as entry, i (entry.type + ':' + entry.id)}
					{#if i > 0}
						<span class="trail-sep" aria-hidden="true">›</span>
					{/if}
					<a
						href={entry.href}
						class="trail-item"
						class:trail-item--active={isActive(entry)}
						title={entry.title}
					>
						<img
							src={thumbSrc(entry)}
							alt={entry.title}
							class="trail-thumb"
							class:trail-thumb--round={entry.type === 'person'}
						/>
						<span class="trail-label">{entry.title}</span>
					</a>
				{/each}
			{/if}
		</div>

		<button
			class="trail-clear"
			onclick={() => navHistory.clear()}
			aria-label="Clear navigation trail"
			title="Clear trail"
		>
			<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
				<path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
			</svg>
		</button>
	</div>
{/if}

<style>
	.trail-wrap {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		/* Match the app's standard container: max-w-7xl centered with px-4 */
		max-width: 80rem;
		margin-left: auto;
		margin-right: auto;
		padding: 0 1rem 0.5rem;
	}

	.trail-inner {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		overflow-x: auto;
		scrollbar-width: none;
		flex: 1;
		min-width: 0;
	}

	.trail-inner::-webkit-scrollbar {
		display: none;
	}

	.trail-sep {
		flex-shrink: 0;
		font-size: 0.75rem;
		color: var(--color-surface-300);
		padding: 0 0.125rem;
		user-select: none;
	}

	.trail-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-shrink: 0;
		padding: 0.25rem 0.5rem 0.25rem 0.25rem;
		border-radius: 9999px;
		text-decoration: none;
		transition: background 0.15s ease;
		color: var(--color-ink-500);
		font-size: 0.75rem;
		font-weight: 500;
		max-width: 10rem;
	}

	.trail-item:hover {
		background: var(--color-surface-700);
		color: var(--color-ink-300);
	}

	.trail-item--active {
		color: var(--color-amber-500);
		background: color-mix(in srgb, var(--color-amber-500) 12%, transparent);
	}

	.trail-item--active:hover {
		background: color-mix(in srgb, var(--color-amber-500) 20%, transparent);
		color: var(--color-amber-500);
	}

	.trail-thumb {
		width: 1.25rem;
		height: 1.25rem;
		object-fit: cover;
		border-radius: 0.2rem;
		flex-shrink: 0;
		background: var(--color-surface-700);
	}

	.trail-thumb--round {
		height: 1.25rem;
		border-radius: 9999px;
	}

	.trail-label {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.trail-expand {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
		border: 1px solid var(--color-surface-500);
		background: none;
		color: var(--color-ink-500);
		font-size: 0.875rem;
		line-height: 1;
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
		letter-spacing: 0.05em;
	}

	.trail-expand:hover {
		background: var(--color-surface-700);
		color: var(--color-ink-300);
		border-color: var(--color-surface-400);
	}

	.trail-clear {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 9999px;
		border: none;
		background: none;
		color: var(--color-surface-300);
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease;
		padding: 0;
	}

	.trail-clear:hover {
		background: var(--color-surface-700);
		color: var(--color-ink-300);
	}
</style>

