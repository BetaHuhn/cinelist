<script lang="ts">
	import { goto } from '$app/navigation'
	import { personContextMenu, closePersonContextMenu } from '$lib/stores/personContextMenu'
	import { favoritePeople, addPersonToFavorites, removePersonFromFavorites } from '$lib/stores/people'
	import { addToast } from '$lib/stores/ui'

	const ctx = $derived($personContextMenu)
	const open = $derived(ctx.open)
	const isFavorite = $derived($favoritePeople.some(p => p.id === ctx.id))

	let menuEl = $state<HTMLDivElement | null>(null)
	let adjustedX = $state(0)
	let adjustedY = $state(0)
	let visible = $state(false)

	$effect(() => {
		if (!open) {
			visible = false
			return
		}

		adjustedX = ctx.x
		adjustedY = ctx.y
		visible = false

		requestAnimationFrame(() => {
			if (!menuEl || !open) return
			const { innerWidth, innerHeight } = window
			const { offsetWidth, offsetHeight } = menuEl

			let x = ctx.x
			let y = ctx.y

			if (x + offsetWidth > innerWidth - 8) x = innerWidth - offsetWidth - 8
			if (y + offsetHeight > innerHeight - 8) y = innerHeight - offsetHeight - 8
			if (x < 8) x = 8
			if (y < 8) y = 8

			adjustedX = x
			adjustedY = y
			visible = true
		})
	})

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopPropagation()
			closePersonContextMenu()
		}
	}

	function handleOutsideClick(e: MouseEvent) {
		if (menuEl && !menuEl.contains(e.target as Node)) closePersonContextMenu()
	}

	async function handleOpen() {
		closePersonContextMenu()
		await goto(ctx.href)
	}

	async function handleCopyUrl() {
		const href = ctx.href
		closePersonContextMenu()
		try {
			const url = `${window.location.origin}${href}`
			await navigator.clipboard.writeText(url)
			addToast('URL copied to clipboard', 'success')
		} catch {
			addToast('Failed to copy URL', 'error')
		}
	}

	async function handleToggleFavorite() {
		const { id, name, profile_path, known_for_department } = ctx
		const wasFavorite = isFavorite
		closePersonContextMenu()
		try {
			if (wasFavorite) {
				await removePersonFromFavorites(id)
				addToast('Removed from favorites', 'success')
			} else {
				await addPersonToFavorites({ id, name, profile_path, known_for_department })
				addToast('Added to favorites', 'success')
			}
		} catch {
			addToast('Something went wrong', 'error')
		}
	}
</script>

<svelte:window
	onkeydown={(e) => { if (open) handleKeydown(e) }}
	onclick={(e) => { if (open) handleOutsideClick(e) }}
/>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={menuEl}
		role="menu"
		tabindex="-1"
		aria-label="Person actions"
		class="fixed z-[200] min-w-48 rounded-xl shadow-2xl py-1"
		style="left: {adjustedX}px; top: {adjustedY}px; visibility: {visible ? 'visible' : 'hidden'}; background: var(--color-surface-800); border: 1px solid color-mix(in srgb, var(--color-surface-600) 60%, transparent); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6)"
		onkeydown={(e) => e.stopPropagation()}
	>
		<!-- Open -->
		<button
			role="menuitem"
			type="button"
			onclick={handleOpen}
			class="w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors duration-100"
			style="color: var(--color-ink-100)"
			onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-700)' }}
			onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="size-4 shrink-0" style="color: var(--color-ink-500)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" /><path d="M11 13l9 -9" /><path d="M15 4h5v5" /></svg>
			Open
		</button>

		<!-- Separator -->
		<div class="my-1 mx-2" style="border-top: 1px solid var(--color-surface-700)"></div>

		<!-- Add/Remove Favorite -->
		<button
			role="menuitem"
			type="button"
			onclick={handleToggleFavorite}
			class="w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors duration-100"
			style="color: {isFavorite ? 'var(--color-ink-300)' : 'var(--color-amber-500)'}"
			onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-700)' }}
			onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}
		>
			{#if isFavorite}
				<svg xmlns="http://www.w3.org/2000/svg" class="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg>
				Remove from Favorites
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" class="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg>
				Add to Favorites
			{/if}
		</button>

		<!-- Separator -->
		<div class="my-1 mx-2" style="border-top: 1px solid var(--color-surface-700)"></div>

		<!-- Copy URL -->
		<button
			role="menuitem"
			type="button"
			onclick={handleCopyUrl}
			class="w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors duration-100"
			style="color: var(--color-ink-100)"
			onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-700)' }}
			onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="size-4 shrink-0" style="color: var(--color-ink-500)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 15l6 -6" /><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464" /><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463" /></svg>
			Copy Link
		</button>
	</div>
{/if}
