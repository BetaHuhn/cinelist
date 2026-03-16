<script lang="ts">
	import { blacklist, addToBlacklist, removeFromBlacklist } from '$lib/stores/blacklist'
	import { addToast } from '$lib/stores/ui'
	import type { MediaType } from '$lib/types/app'

	interface Props {
		id: number
		mediaType: MediaType
		title: string
		poster_path: string | null
	}

	let { id, mediaType, title, poster_path }: Props = $props()

	let open = $state(false)
	let menuEl = $state<HTMLDivElement | null>(null)

	const blacklisted = $derived($blacklist.some(i => i.id === id && i.mediaType === mediaType))

	function toggle() {
		open = !open
	}

	function close() {
		open = false
	}

	async function handleBlacklist() {
		close()
		try {
			if (blacklisted) {
				await removeFromBlacklist(id, mediaType)
				addToast('Removed from hidden items', 'success')
			} else {
				await addToBlacklist({ id, mediaType, title, poster_path })
				addToast('Hidden permanently', 'success')
			}
		} catch {
			addToast('Something went wrong', 'error')
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close()
	}

	function handleOutsideClick(e: MouseEvent) {
		if (menuEl && !menuEl.contains(e.target as Node)) close()
	}
</script>

<svelte:window onkeydown={handleKeydown} onclick={handleOutsideClick} />

<div class="relative" bind:this={menuEl}>
	<button
		type="button"
		onclick={(e) => { e.stopPropagation(); toggle() }}
		aria-label="More options"
		aria-expanded={open}
		aria-haspopup="menu"
		class="inline-flex items-center justify-center size-10 rounded-lg transition-all duration-150 active:scale-95 btn-ghost"
		title="More options"
	>
		<!-- Three vertical dots icon -->
		<svg xmlns="http://www.w3.org/2000/svg" class="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>
	</button>

	{#if open}
		<div
			role="menu"
			class="absolute z-50 right-0 top-full mt-1 min-w-44 rounded-xl shadow-xl overflow-hidden"
			style="background: var(--color-surface-800); border: 1px solid var(--color-surface-700)"
		>
			<button
				role="menuitem"
				type="button"
				onclick={handleBlacklist}
				class="w-full text-left px-4 py-2 text-sm transition-colors duration-100 flex items-center gap-2"
				style={blacklisted
					? 'color: var(--color-ink-300)'
					: 'color: var(--color-ink-300)'}
				onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-700)' }}
				onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}
			>
				{#if blacklisted}
					<svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" /></svg>
					Show again
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" /><path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" /><path d="M3 3l18 18" /></svg>
					Hide permanently
				{/if}
			</button>
		</div>
	{/if}
</div>
