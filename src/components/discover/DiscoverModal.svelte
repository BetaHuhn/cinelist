<script lang="ts">
	import { fade } from 'svelte/transition'
	import {
		discoverOpen,
		discoverCards,
		discoverLoading,
		discoverHistory,
		discoverLibraryMode,
		closeDiscover,
		swipeRight,
		swipeLeft,
		fetchMoreCards
	} from '$lib/stores/discover'
	import SwipeCard from '$components/discover/SwipeCard.svelte'
	import type { TMDBMediaResult } from '$lib/types/tmdb'

	// The top 3 cards to render (top = index 0)
	const visibleCards = $derived($discoverCards.slice(0, 3))
	const topCard = $derived<TMDBMediaResult | undefined>(visibleCards[0])

	const liked = $derived($discoverHistory.filter(h => h.action === 'like').length)
	const skipped = $derived($discoverHistory.filter(h => h.action === 'dislike').length)

	/** forcedSwipe drives animation on the top card via its prop */
	let forcedSwipe = $state<'left' | 'right' | null>(null)
	/** Guard: true while an animation is in flight — blocks additional swipe triggers */
	let swipeInFlight = $state(false)

	function handleLike() {
		if (!topCard || swipeInFlight) return
		swipeInFlight = true
		const card = topCard
		forcedSwipe = 'right'
		// Reset forcedSwipe BEFORE removing the card from the store so it does
		// not get inherited by the next card, then kick off the store update.
		setTimeout(() => {
			forcedSwipe = null
			swipeInFlight = false
			void swipeRight(card)
		}, 400)
	}

	function handleDislike() {
		if (!topCard || swipeInFlight) return
		swipeInFlight = true
		const card = topCard
		forcedSwipe = 'left'
		setTimeout(() => {
			forcedSwipe = null
			swipeInFlight = false
			void swipeLeft(card)
		}, 400)
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!$discoverOpen) return
		if (e.repeat) return
		if (e.key === 'Escape') closeDiscover()
		if ((e.key === 'ArrowRight' || e.key === 'l') && topCard) handleLike()
		if ((e.key === 'ArrowLeft' || e.key === 'h') && topCard) handleDislike()
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) closeDiscover()
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if $discoverOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		style="background: rgba(0,0,0,0.85); backdrop-filter: blur(8px)"
		transition:fade={{ duration: 200 }}
		onclick={handleBackdropClick}
	>
		<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
		<div
			class="relative w-full max-w-sm flex flex-col gap-5"
			style="outline: none"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-label="Discover movies"
			tabindex="-1"
		>
			<!-- Header -->
			<div class="flex items-center justify-between">
				<div>
					<h2 class="text-lg font-bold text-white">{$discoverLibraryMode ? 'What to Watch' : 'Discover'}</h2>
					<p class="text-xs" style="color: var(--color-ink-500)">
						{#if $discoverLibraryMode}
							{liked} picked · {skipped} skipped
						{:else}
							{liked} added · {skipped} skipped
						{/if}
					</p>
				</div>
				<button
					class="size-8 rounded-full flex items-center justify-center transition-colors"
					style="background: var(--color-surface-700); color: var(--color-ink-300)"
					onclick={closeDiscover}
					aria-label="Close discover"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 24 24" fill="none"
						stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M18 6 6 18M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Card stack -->
			<div class="relative w-full" style="height: 480px">
				{#if $discoverLoading && visibleCards.length === 0}
					<div class="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl"
						style="background: var(--color-surface-800)">
						<span class="size-8 border-2 border-current border-t-transparent rounded-full animate-spin"
							style="color: var(--color-ink-400)"></span>
						<p class="text-sm" style="color: var(--color-ink-400)">Finding recommendations…</p>
					</div>
				{:else if visibleCards.length === 0}
					<div class="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl"
						style="background: var(--color-surface-800)">
						<svg xmlns="http://www.w3.org/2000/svg" class="size-12 opacity-30" viewBox="0 0 24 24"
							fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
							<path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" />
							<path d="M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
							<path d="M12 14c-4 0-6 2-6 4" />
						</svg>
						<p class="text-sm font-medium" style="color: var(--color-ink-300)">No more suggestions</p>
						<p class="text-xs text-center px-4" style="color: var(--color-ink-500)">
							Add more titles to your watchlist to improve recommendations
						</p>
						<button
							class="mt-2 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
							style="background: var(--color-surface-600); color: var(--color-ink-100)"
							onclick={() => fetchMoreCards()}
						>
							Try Again
						</button>
					</div>
				{:else}
					{#each [...visibleCards].reverse() as card, revIdx (card.media_type + ':' + card.id)}
						{@const stackIndex = visibleCards.length - 1 - revIdx}
						{@const isTop = stackIndex === 0}
						<SwipeCard
							item={card}
							active={isTop}
							{stackIndex}
							onlike={() => { void swipeRight(card) }}
							ondislike={() => { void swipeLeft(card) }}
							forcedSwipe={isTop ? forcedSwipe : null}
						/>
					{/each}
				{/if}
			</div>

			<!-- Action buttons -->
			{#if topCard}
				<div class="flex items-center justify-center gap-6">
					<!-- Dislike / Skip -->
					<button
						class="size-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-150 active:scale-90"
						style="background: rgba(248,113,113,0.15); border: 2px solid rgba(248,113,113,0.4); color: #f87171"
						onclick={handleDislike}
						title="Skip (← or H)"
						aria-label="Skip this title"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="size-6" viewBox="0 0 24 24" fill="none"
							stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<path d="M18 6 6 18M6 6l12 12" />
						</svg>
					</button>

					<!-- Like / Add -->
					<button
						class="size-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-150 active:scale-90"
						style="background: rgba(74,222,128,0.15); border: 2px solid rgba(74,222,128,0.4); color: #4ade80"
						onclick={handleLike}
						title="Add to watchlist (→ or L)"
						aria-label="Add to watchlist"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="size-6" viewBox="0 0 24 24" fill="none"
							stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
						</svg>
					</button>
				</div>
			{/if}

			<!-- Hint text -->
			<p class="text-center text-xs" style="color: var(--color-ink-600)">
				{#if $discoverLibraryMode}
					Swipe right or press → / L to pick · swipe left or press ← / H to skip
				{:else}
					Swipe right or press → / L to add · swipe left or press ← / H to skip
				{/if}
			</p>
		</div>
	</div>
{/if}
