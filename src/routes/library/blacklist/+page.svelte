<script lang="ts">
	import { fade } from 'svelte/transition'
	import { blacklist, removeFromBlacklist } from '$lib/stores/blacklist'
	import { addToast } from '$lib/stores/ui'
	import { posterUrl } from '$lib/utils/image'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	// Seed the store with server-side data
	import { onMount } from 'svelte'
	onMount(() => {
		blacklist.set(data.items)
	})

	async function handleRemove(id: number, mediaType: 'movie' | 'tv') {
		try {
			await removeFromBlacklist(id, mediaType)
			addToast('Removed from hidden items', 'success')
		} catch {
			addToast('Something went wrong', 'error')
		}
	}
</script>

<svelte:head>
	<title>Hidden Items — CineList</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 py-8" in:fade={{ duration: 200 }}>
	<div class="flex items-center gap-4 mb-8">
		<a
			href="/library"
			class="inline-flex items-center gap-1.5 text-sm transition-colors"
			style="color: var(--color-ink-400)"
			onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-ink-100)' }}
			onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-ink-400)' }}
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M19 12H5M12 19l-7-7 7-7"/>
			</svg>
			Library
		</a>
		<h1 class="text-2xl font-bold" style="color: var(--color-ink-50)">Hidden Items</h1>
		<span class="text-sm" style="color: var(--color-ink-500)">{$blacklist.length} items</span>
	</div>

	{#if $blacklist.length === 0}
		<div class="flex flex-col items-center justify-center py-24 gap-4 text-center">
			<div class="text-5xl opacity-30" aria-hidden="true">
				<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-ink-500)">
					<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
					<line x1="1" y1="1" x2="23" y2="23"/>
				</svg>
			</div>
			<p class="text-lg font-medium" style="color: var(--color-ink-300)">No hidden items</p>
			<p class="text-sm max-w-xs" style="color: var(--color-ink-500)">
				Items you hide from movie or show pages will appear here. You can unhide them at any time.
			</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
			{#each $blacklist as item (item.mediaType + ':' + item.id)}
				<div
					class="flex gap-3 rounded-xl overflow-hidden"
					style="background: var(--color-surface-800)"
					in:fade={{ duration: 150 }}
				>
					<a
						href={item.mediaType === 'tv' ? `/tv/${item.id}` : `/movie/${item.id}`}
						class="shrink-0"
						tabindex="-1"
					>
						<div class="w-16 h-full" style="background: var(--color-surface-700); min-height: 80px">
							<img
								src={posterUrl(item.poster_path, 'w185')}
								alt={item.title}
								class="w-full h-full object-cover"
								loading="lazy"
							/>
						</div>
					</a>
					<div class="flex flex-col justify-between py-3 pr-3 flex-1 min-w-0 gap-2">
						<div class="min-w-0">
							<a
								href={item.mediaType === 'tv' ? `/tv/${item.id}` : `/movie/${item.id}`}
								class="text-sm font-semibold truncate block hover:underline underline-offset-2"
								style="color: var(--color-ink-100)"
							>
								{item.title}
							</a>
							<span class="text-xs uppercase tracking-wide" style="color: var(--color-ink-500)">
								{item.mediaType === 'tv' ? 'TV Show' : 'Movie'}
							</span>
						</div>
						<button
							type="button"
							onclick={() => handleRemove(item.id, item.mediaType)}
							class="text-xs font-medium self-start rounded-md px-2.5 py-1 transition-colors duration-100"
							style="background: var(--color-surface-700); color: var(--color-ink-400)"
							onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-ink-100)' }}
							onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-ink-400)' }}
						>
							Show again
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
