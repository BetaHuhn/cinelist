<script lang="ts">
	import { setPersonalRating } from '$lib/stores/watchlist'
	import type { MediaType } from '$lib/types/app'

	interface Props {
		id: number
		mediaType: MediaType
		rating: number | undefined
		readonly?: boolean
	}

	let { id, mediaType, rating, readonly = false }: Props = $props()

	let hovered = $state(0)

	async function handleClick(star: number, e: MouseEvent) {
		e.preventDefault()
		e.stopPropagation()
		// Click the already-selected star to clear the rating
		await setPersonalRating(id, mediaType, rating === star ? null : star)
	}

	function handlePointerEnter(star: number) {
		if (!readonly) hovered = star
	}

	function handlePointerLeave() {
		hovered = 0
	}

	const displayed = $derived(hovered > 0 ? hovered : (rating ?? 0))
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="flex items-center gap-0.5"
	data-no-preview
	onpointerleave={handlePointerLeave}
	role={readonly ? undefined : 'group'}
	aria-label={readonly ? `${rating ?? 0} out of 5 stars` : 'Rate this item'}
>
	{#each [1, 2, 3, 4, 5] as star (star)}
		{#if readonly}
			<span
				class="text-sm leading-none"
				style={displayed >= star ? 'color: var(--color-amber-500)' : 'color: var(--color-surface-600)'}
				aria-hidden="true"
			>★</span>
		{:else}
			<button
				type="button"
				class="text-sm leading-none transition-colors"
				style={displayed >= star ? 'color: var(--color-amber-500)' : 'color: var(--color-surface-600)'}
				aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
				onpointerenter={() => handlePointerEnter(star)}
				onclick={(e) => handleClick(star, e)}
			>★</button>
		{/if}
	{/each}
</div>
