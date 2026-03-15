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
		<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<circle cx="12" cy="5" r="2" />
			<circle cx="12" cy="12" r="2" />
			<circle cx="12" cy="19" r="2" />
		</svg>
	</button>

	{#if open}
		<div
			role="menu"
			class="absolute z-50 right-0 top-full mt-1 min-w-44 rounded-xl py-1 shadow-xl"
			style="background: var(--color-surface-700); border: 1px solid var(--color-surface-600)"
		>
			<button
				role="menuitem"
				type="button"
				onclick={handleBlacklist}
				class="w-full text-left px-4 py-2.5 text-sm transition-colors duration-100 flex items-center gap-2"
				style={blacklisted
					? 'color: var(--color-ink-300)'
					: 'color: var(--color-ink-300)'}
				onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-600)' }}
				onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}
			>
				{#if blacklisted}
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M2.5 2.5l19 19M12 4.5C7 4.5 2.73 7.61 1 12c.59 1.44 1.45 2.73 2.52 3.79M20.25 7.47A10.94 10.94 0 0 1 23 12c-1.73 4.39-6 7.5-11 7.5a10.87 10.87 0 0 1-5.78-1.66"/>
					</svg>
					Show again
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
						<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
						<line x1="1" y1="1" x2="23" y2="23"/>
					</svg>
					Hide permanently
				{/if}
			</button>
		</div>
	{/if}
</div>
