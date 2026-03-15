import { storage } from '$storage'
import type { BlacklistItem } from '$lib/types/app'

type MediaType = BlacklistItem['mediaType']

const PREFIX = 'blacklist'
const key = (mediaType: MediaType, id: number) => `${PREFIX}:${mediaType}:${id}`

function normalize(item: BlacklistItem | null): BlacklistItem | null {
	if (!item) return null
	const id = typeof (item as any).id === 'number' ? (item as any).id : Number((item as any).id)
	if (!Number.isFinite(id) || id <= 0) return null
	const title = typeof (item as any).title === 'string' ? (item as any).title.trim() : ''
	if (!title) return null
	const mediaType: MediaType = (item as any).mediaType === 'tv' ? 'tv' : 'movie'
	const addedAt = typeof (item as any).addedAt === 'number' ? (item as any).addedAt : 0
	return {
		id,
		title,
		mediaType,
		poster_path: typeof (item as any).poster_path === 'string' ? (item as any).poster_path : null,
		addedAt
	}
}

export async function getBlacklist(): Promise<BlacklistItem[]> {
	const keys = await storage.getKeys(PREFIX)
	const raw = await Promise.all(keys.map(k => storage.getItem<BlacklistItem>(k)))
	return raw
		.map(i => normalize(i))
		.filter(Boolean)
		.sort((a, b) => (b as BlacklistItem).addedAt - (a as BlacklistItem).addedAt) as BlacklistItem[]
}

export async function getBlacklistItem(mediaType: MediaType, id: number): Promise<BlacklistItem | null> {
	const item = await storage.getItem<BlacklistItem>(key(mediaType, id))
	return normalize(item)
}

export async function addBlacklistItem(
	item: Omit<BlacklistItem, 'addedAt'>
): Promise<BlacklistItem> {
	const full: BlacklistItem = { ...item, addedAt: Date.now() }
	await storage.setItem(key(item.mediaType, item.id), full)
	return full
}

export async function removeBlacklistItem(mediaType: MediaType, id: number): Promise<void> {
	await storage.removeItem(key(mediaType, id))
}
