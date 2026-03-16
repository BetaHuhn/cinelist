<script lang="ts">
	import { watchlist, rateItem } from '$lib/stores/watchlist'
	import { addToast } from '$lib/stores/ui'
	import type { MediaType } from '$lib/types/app'

	interface Props {
		id: number
		mediaType: MediaType
	}

	let { id, mediaType }: Props = $props()

	const item = $derived($watchlist.find(i => i.id === id && i.mediaType === mediaType))
	let hovered = $state<number | null>(null)

	const currentRating = $derived(item?.userRating ?? null)
	const displayRating = $derived(hovered ?? currentRating)

	async function handleRate(star: number) {
		if (!item) return
		// Click the same star to clear the rating
		const newRating = currentRating === star ? null : star
		try {
			await rateItem(id, mediaType, newRating)
		} catch {
			addToast('Could not save rating', 'error')
		}
	}
</script>

{#if item}
	<div class="flex flex-col gap-1.5">
		<p class="text-xs font-medium" style="color: var(--color-ink-500)">Your Rating</p>
		<div class="flex items-center gap-0.5">
			{#each Array.from({ length: 10 }, (_, i) => i + 1) as star}
				<button
					type="button"
					onclick={() => handleRate(star)}
					onmouseenter={() => (hovered = star)}
					onmouseleave={() => (hovered = null)}
					class="text-xl leading-none transition-colors duration-100 hover:scale-110 active:scale-95"
					style={star <= (displayRating ?? 0)
						? 'color: var(--color-amber-400)'
						: 'color: var(--color-surface-600)'}
					aria-label={`Rate ${star} out of 10`}
					title={`Rate ${star}/10`}
				>★</button>
			{/each}
			{#if currentRating !== null}
				<span class="ml-2 text-sm font-bold" style="color: var(--color-amber-400)">{currentRating}/10</span>
				<button
					type="button"
					onclick={() => handleRate(currentRating)}
					class="ml-1 text-xs leading-none transition-colors duration-100 hover:opacity-80"
					style="color: var(--color-ink-500)"
					title="Clear rating"
					aria-label="Clear rating"
				>✕</button>
			{/if}
		</div>
	</div>
{/if}
