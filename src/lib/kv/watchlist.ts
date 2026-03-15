import { storage } from '$storage'
import type { WatchlistItem } from '$lib/types/app'

type MediaType = WatchlistItem['mediaType']

const PREFIX = 'watchlist'
const key = (mediaType: MediaType, id: number) => `${PREFIX}:${mediaType}:${id}`
const legacyKey = (id: number) => `${PREFIX}:${id}`

function normalizeItem(
	item: WatchlistItem | (Omit<WatchlistItem, 'mediaType'> & { mediaType?: MediaType }) | null
):
	| WatchlistItem
	| null {
	if (!item) return null
	const mediaType: MediaType = item.mediaType ?? 'movie'
	const addedAt = typeof (item as WatchlistItem).addedAt === 'number' ? (item as WatchlistItem).addedAt : Date.now()
	const onMediaServer = typeof (item as WatchlistItem).onMediaServer === 'boolean' ? (item as WatchlistItem).onMediaServer : false
	const watched = typeof (item as WatchlistItem).watched === 'boolean' ? (item as WatchlistItem).watched : false
	return { ...(item as WatchlistItem), mediaType, addedAt, onMediaServer, watched }
}

export async function getWatchlist(): Promise<WatchlistItem[]> {
	const keys = await storage.getKeys(PREFIX)
	const itemsRaw = await Promise.all(keys.map(k => storage.getItem<WatchlistItem>(k)))
	const items = itemsRaw.map(i => normalizeItem(i)).filter(Boolean) as WatchlistItem[]

	// Deduplicate (legacy + new keys can both exist).
	const map = new Map<string, WatchlistItem>()
	for (const item of items) {
		const k = `${item.mediaType}:${item.id}`
		const prev = map.get(k)
		if (!prev || item.addedAt > prev.addedAt) map.set(k, item)
	}

	return Array.from(map.values()).sort((a, b) => b.addedAt - a.addedAt)
}

export async function getItem(mediaType: MediaType, id: number): Promise<WatchlistItem | null> {
	const item = await storage.getItem<WatchlistItem>(key(mediaType, id))
	if (item) return normalizeItem(item)
	// Backwards compat for older movie-only keys.
	if (mediaType === 'movie') {
		const legacy = await storage.getItem<WatchlistItem>(legacyKey(id))
		return legacy ? normalizeItem(legacy) : null
	}
	return null
}

export async function addItem(
	item: Omit<WatchlistItem, 'addedAt' | 'onMediaServer' | 'watched'>
): Promise<WatchlistItem> {
	const full: WatchlistItem = {
		...item,
		addedAt: Date.now(),
		onMediaServer: false,
		watched: false
	}
	await storage.setItem(key(item.mediaType, item.id), full)
	return full
}

export async function removeItem(mediaType: MediaType, id: number): Promise<void> {
	await storage.removeItem(key(mediaType, id))
	// Also remove legacy key for movies.
	if (mediaType === 'movie') {
		await storage.removeItem(legacyKey(id))
	}
}

export async function toggleMediaServer(mediaType: MediaType, id: number): Promise<WatchlistItem | null> {
	const current = await getItem(mediaType, id)
	if (!current) return null
	const updated: WatchlistItem = { ...current, onMediaServer: !current.onMediaServer }

	// If the item lives under the legacy movie key, keep updating it there.
	if (mediaType === 'movie') {
		const legacy = await storage.getItem<WatchlistItem>(legacyKey(id))
		if (legacy) {
			await storage.setItem(legacyKey(id), updated)
			return updated
		}
	}

	await storage.setItem(key(mediaType, id), updated)
	return updated
}

export async function toggleWatched(mediaType: MediaType, id: number): Promise<WatchlistItem | null> {
	const current = await getItem(mediaType, id)
	if (!current) return null
	const updated: WatchlistItem = { ...current, watched: !current.watched }

	// If the item lives under the legacy movie key, keep updating it there.
	if (mediaType === 'movie') {
		const legacy = await storage.getItem<WatchlistItem>(legacyKey(id))
		if (legacy) {
			await storage.setItem(legacyKey(id), updated)
			return updated
		}
	}

	await storage.setItem(key(mediaType, id), updated)
	return updated
}
