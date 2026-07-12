import { writable, get } from 'svelte/store'
import type { TMDBMediaResult } from '$lib/types/tmdb'
import type { WatchlistItem } from '$lib/types/app'
import { addToWatchlist, isInWatchlist, watchlist } from '$lib/stores/watchlist'

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
/** True when the modal was opened in library mode (items ready to watch first). */
export const discoverLibraryMode = writable(false)

const DISMISSED_KEY = 'cinelist:discover:dismissed'

function loadDismissed(): Set<string> {
	try {
		const raw = localStorage.getItem(DISMISSED_KEY)
		if (raw) return new Set(JSON.parse(raw) as string[])
	} catch { /* noop — SSR or private browsing */ }
	return new Set()
}

function saveDismissed(keys: Set<string>): void {
	try {
		localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(keys)))
	} catch { /* noop */ }
}

/** Keys dismissed (swiped left) by the user — persisted across opens via localStorage. */
let dismissedKeys: Set<string> = new Set()

/** Keys already in the current deck — prevents re-fetching duplicates. */
const sessionSeen = new Set<string>()

function toTMDBMediaResult(item: WatchlistItem): TMDBMediaResult {
	const base = {
		id: item.id,
		overview: '',
		poster_path: item.poster_path,
		backdrop_path: item.backdrop_path,
		vote_average: item.vote_average,
		vote_count: 0,
		genre_ids: item.genre_ids,
		popularity: 0,
		original_language: 'en' as const
	}
	if (item.mediaType === 'movie') {
		return { ...base, media_type: 'movie' as const, title: item.title, release_date: item.release_date }
	}
	return { ...base, media_type: 'tv' as const, name: item.title, first_air_date: item.release_date }
}

function shuffle<T>(arr: T[]): T[] {
	const a = [...arr]
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[a[i], a[j]] = [a[j], a[i]]
	}
	return a
}

export function openDiscover(mode: 'home' | 'library' = 'home') {
	// Reload persisted dismissed keys on every open.
	dismissedKeys = loadDismissed()
	sessionSeen.clear()
	discoverHistory.set([])
	discoverCards.set([])
	discoverLibraryMode.set(mode === 'library')
	discoverOpen.set(true)

	if (mode === 'library') {
		// Pre-populate the deck with watchlist items: onMediaServer (ready) first, then pending.
		// Items the user has previously dismissed are excluded.
		const wl = get(watchlist)
		const isDismissed = (i: WatchlistItem) => dismissedKeys.has(`${i.mediaType}:${i.id}`)
		const ready = shuffle(wl.filter(i => i.onMediaServer && !i.watched && !isDismissed(i)))
		const pending = shuffle(wl.filter(i => !i.onMediaServer && !i.watched && !isDismissed(i)))
		const libraryCards = [...ready, ...pending].map(toTMDBMediaResult)
		discoverCards.set(libraryCards)
		for (const card of libraryCards) sessionSeen.add(`${card.media_type}:${card.id}`)
	}

	// Fetch TMDB recommendations to pad the deck (appended after any library cards).
	void fetchMoreCards()
}

export function closeDiscover() {
	discoverOpen.set(false)
}

export async function fetchMoreCards() {
	discoverLoading.set(true)
	try {
		// Exclude both dismissed keys and everything already in the deck.
		const allExcluded = new Set([...dismissedKeys, ...sessionSeen])
		const excluded = Array.from(allExcluded).join(',')
		const params = new URLSearchParams({ limit: '60' })
		if (excluded) params.set('excluded', excluded)
		const res = await fetch(`/api/discover?${params}`)
		if (!res.ok) return
		const items = (await res.json()) as TMDBMediaResult[]
		// Append without duplicates (guards against race conditions).
		const currentKeys = new Set(get(discoverCards).map(c => `${c.media_type}:${c.id}`))
		const fresh = items.filter(i => !currentKeys.has(`${i.media_type}:${i.id}`))
		discoverCards.update(cards => [...cards, ...fresh])
	} finally {
		discoverLoading.set(false)
	}
}

export async function swipeRight(item: TMDBMediaResult) {
	const key = `${item.media_type}:${item.id}`
	sessionSeen.add(key)

	discoverHistory.update(h => [
		...h,
		{ id: item.id, mediaType: item.media_type, action: 'like', genre_ids: item.genre_ids ?? [] }
	])

	// Remove from deck
	discoverCards.update(cards => cards.filter(c => !(c.id === item.id && c.media_type === item.media_type)))

	// Only add to watchlist if not already there (library-mode items are already watchlisted).
	if (!isInWatchlist(item.id, item.media_type)) {
		await addToWatchlist(item)
	}

	// Refill deck if running low
	if (get(discoverCards).length < 10) {
		await fetchMoreCards()
	}
}

export async function swipeLeft(item: TMDBMediaResult) {
	const key = `${item.media_type}:${item.id}`
	sessionSeen.add(key)
	// Persist the dismissal so the item won't appear on future opens.
	dismissedKeys.add(key)
	saveDismissed(dismissedKeys)

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
