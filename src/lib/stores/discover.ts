import { writable, get } from 'svelte/store'
import type { TMDBMediaResult } from '$lib/types/tmdb'
import { addToWatchlist } from '$lib/stores/watchlist'

export interface SwipeRecord {
	id: number
	mediaType: 'movie' | 'tv'
	action: 'like' | 'dislike'
	genre_ids: number[]
}

export const discoverOpen = writable(false)
export const discoverCards = writable<TMDBMediaResult[]>([])
export const discoverLoading = writable(false)
export const discoverHistory = writable<SwipeRecord[]>([])

/** Keys of items already shown (liked or disliked) in this session. */
const sessionExcluded = new Set<string>()

export function openDiscover() {
	discoverHistory.set([])
	sessionExcluded.clear()
	discoverCards.set([])
	discoverOpen.set(true)
	void fetchMoreCards()
}

export function closeDiscover() {
	discoverOpen.set(false)
}

export async function fetchMoreCards() {
	discoverLoading.set(true)
	try {
		const excluded = Array.from(sessionExcluded).join(',')
		const params = new URLSearchParams({ limit: '60' })
		if (excluded) params.set('excluded', excluded)
		const res = await fetch(`/api/discover?${params}`)
		if (!res.ok) return
		const items = (await res.json()) as TMDBMediaResult[]
		// Append without duplicates
		const current = get(discoverCards)
		const currentKeys = new Set(current.map(c => `${c.media_type}:${c.id}`))
		const fresh = items.filter(i => !currentKeys.has(`${i.media_type}:${i.id}`))
		discoverCards.update(cards => [...cards, ...fresh])
	} finally {
		discoverLoading.set(false)
	}
}

export async function swipeRight(item: TMDBMediaResult) {
	const key = `${item.media_type}:${item.id}`
	sessionExcluded.add(key)

	discoverHistory.update(h => [
		...h,
		{ id: item.id, mediaType: item.media_type, action: 'like', genre_ids: item.genre_ids ?? [] }
	])

	// Remove from deck
	discoverCards.update(cards => cards.filter(c => !(c.id === item.id && c.media_type === item.media_type)))

	// Add to watchlist (optimistic)
	await addToWatchlist(item)

	// Refill deck if running low
	if (get(discoverCards).length < 10) {
		await fetchMoreCards()
	}
}

export async function swipeLeft(item: TMDBMediaResult) {
	const key = `${item.media_type}:${item.id}`
	sessionExcluded.add(key)

	discoverHistory.update(h => [
		...h,
		{ id: item.id, mediaType: item.media_type, action: 'dislike', genre_ids: item.genre_ids ?? [] }
	])

	// Remove from deck
	discoverCards.update(cards => cards.filter(c => !(c.id === item.id && c.media_type === item.media_type)))

	// Refill deck if running low
	if (get(discoverCards).length < 10) {
		await fetchMoreCards()
	}
}
