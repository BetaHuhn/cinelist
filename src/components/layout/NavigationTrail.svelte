<script lang="ts">
	import { page } from '$app/state'
	import { fly } from 'svelte/transition'
	import { navHistory, type NavEntry } from '$lib/stores/navigationHistory'
	import { posterUrl, profileUrl } from '$lib/utils/image'

	const entries = $derived($navHistory)
	const currentPath = $derived(page.url.pathname)

	function thumbSrc(entry: NavEntry): string {
		if (entry.type === 'person') return profileUrl(entry.posterPath, 'w45')
		return posterUrl(entry.posterPath, 'w92')
	}

	function isActive(entry: NavEntry): boolean {
		return currentPath === entry.href
	}

	let trailEl: HTMLElement | undefined = $state()

	// Auto-scroll the active item into view when entries change
	$effect(() => {
		if (!trailEl || !entries.length) return
		const active = trailEl.querySelector<HTMLElement>('[data-active="true"]')
		active?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
	})
</script>

{#if entries.length >= 2}
	<div class="trail-wrap" transition:fly={{ y: -6, duration: 180 }}>
		<div class="trail-inner" bind:this={trailEl}>
			{#each entries as entry, i (entry.type + ':' + entry.id)}
				{#if i > 0}
					<span class="trail-sep" aria-hidden="true">›</span>
				{/if}
				<a
					href={entry.href}
					class="trail-item"
					class:trail-item--active={isActive(entry)}
					data-active={isActive(entry)}
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
		height: 1.875rem;
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
