import { writable, get } from 'svelte/store'
import type { MediaType, WatchlistItem } from '$lib/types/app'
import type { TMDBMedia } from '$lib/types/tmdb'

export const watchlist = writable<WatchlistItem[]>([])
export const watchlistLoaded = writable(false)

export async function loadWatchlist(): Promise<void> {
	try {
		const res = await fetch('/api/watchlist')
		if (res.ok) {
			const items = (await res.json()) as WatchlistItem[]
			watchlist.set(items)
		}
	} finally {
		watchlistLoaded.set(true)
	}
}

export function isInWatchlist(id: number, mediaType: MediaType = 'movie'): boolean {
	return get(watchlist).some(i => i.id === id && i.mediaType === mediaType)
}

function inferMediaType(media: TMDBMedia): MediaType {
	return 'title' in media ? 'movie' : 'tv'
}

function getTitle(media: TMDBMedia): string {
	return 'title' in media ? media.title : media.name
}

function getReleaseDate(media: TMDBMedia): string {
	return 'release_date' in media ? media.release_date : media.first_air_date
}

export async function addToWatchlist(media: TMDBMedia): Promise<void> {
	const mediaType = inferMediaType(media)
	const payload: Omit<WatchlistItem, 'addedAt' | 'onMediaServer' | 'watched' | 'userRating'> = {
		mediaType,
		id: media.id,
		title: getTitle(media),
		poster_path: media.poster_path,
		backdrop_path: media.backdrop_path,
		release_date: getReleaseDate(media),
		vote_average: media.vote_average,
		genre_ids: media.genre_ids ?? media.genres?.map(g => g.id) ?? []
	}

	// Optimistic update
	const optimistic: WatchlistItem = { ...payload, addedAt: Date.now(), onMediaServer: false, watched: false, userRating: null }
	watchlist.update(items => [optimistic, ...items])

	try {
		const res = await fetch('/api/watchlist', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		})
		if (!res.ok) throw new Error('Failed to add')
		const saved = (await res.json()) as WatchlistItem
		// Replace optimistic with real
		watchlist.update(items =>
			items.map(i => (i.id === saved.id && i.mediaType === saved.mediaType ? saved : i))
		)
	} catch {
		// Revert
		watchlist.update(items => items.filter(i => !(i.id === media.id && i.mediaType === mediaType)))
	}
}

export async function removeFromWatchlist(id: number, mediaType: MediaType = 'movie'): Promise<void> {
	const prev = get(watchlist)
	watchlist.update(items => items.filter(i => !(i.id === id && i.mediaType === mediaType)))

	try {
		const res = await fetch(`/api/watchlist/${id}?type=${mediaType}`, { method: 'DELETE' })
		if (!res.ok && res.status !== 204) throw new Error('Failed to remove')
	} catch {
		watchlist.set(prev)
	}
}

export async function toggleMediaServer(id: number, mediaType: MediaType = 'movie'): Promise<void> {
	const prev = get(watchlist)
	// Optimistic toggle
	watchlist.update(items =>
		items.map(i =>
			i.id === id && i.mediaType === mediaType ? { ...i, onMediaServer: !i.onMediaServer } : i
		)
	)

	try {
		const res = await fetch(`/api/watchlist/${id}?type=${mediaType}`, { method: 'PATCH' })
		if (!res.ok) throw new Error('Failed to toggle')
		const updated = (await res.json()) as WatchlistItem
		watchlist.update(items =>
			items.map(i => (i.id === updated.id && i.mediaType === updated.mediaType ? updated : i))
		)
	} catch {
		watchlist.set(prev)
	}
}

export async function toggleWatched(id: number, mediaType: MediaType = 'movie'): Promise<void> {
	const prev = get(watchlist)
	// Optimistic toggle
	watchlist.update(items =>
		items.map(i =>
			i.id === id && i.mediaType === mediaType ? { ...i, watched: !i.watched } : i
		)
	)

	try {
		const res = await fetch(`/api/watchlist/${id}?type=${mediaType}&toggle=watched`, { method: 'PATCH' })
		if (!res.ok) throw new Error('Failed to toggle')
		const updated = (await res.json()) as WatchlistItem
		watchlist.update(items =>
			items.map(i => (i.id === updated.id && i.mediaType === updated.mediaType ? updated : i))
		)
	} catch {
		watchlist.set(prev)
	}
}

export async function rateItem(id: number, mediaType: MediaType, rating: number | null): Promise<void> {
	const prev = get(watchlist)
	// Optimistic update
	watchlist.update(items =>
		items.map(i =>
			i.id === id && i.mediaType === mediaType ? { ...i, userRating: rating } : i
		)
	)

	try {
		const ratingParam = rating === null ? '' : `&rating=${rating}`
		const res = await fetch(`/api/watchlist/${id}?type=${mediaType}&toggle=rating${ratingParam}`, { method: 'PATCH' })
		if (!res.ok) throw new Error('Failed to rate')
		const updated = (await res.json()) as WatchlistItem
		watchlist.update(items =>
			items.map(i => (i.id === updated.id && i.mediaType === updated.mediaType ? updated : i))
		)
	} catch {
		watchlist.set(prev)
	}
}
