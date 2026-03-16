import { writable, get } from 'svelte/store'
import type { BlacklistItem, MediaType } from '$lib/types/app'

export const blacklist = writable<BlacklistItem[]>([])
export const blacklistLoaded = writable(false)

export async function loadBlacklist(): Promise<void> {
	try {
		const res = await fetch('/api/blacklist')
		if (res.ok) {
			const items = (await res.json()) as BlacklistItem[]
			blacklist.set(items)
		}
	} finally {
		blacklistLoaded.set(true)
	}
}

export function isBlacklisted(id: number, mediaType: MediaType): boolean {
	return get(blacklist).some(i => i.id === id && i.mediaType === mediaType)
}

export async function addToBlacklist(item: Omit<BlacklistItem, 'addedAt'>): Promise<void> {
	const optimistic: BlacklistItem = { ...item, addedAt: Date.now() }
	blacklist.update(items => [optimistic, ...items])

	try {
		const res = await fetch('/api/blacklist', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(item)
		})
		if (!res.ok) throw new Error('Failed to blacklist')
		const saved = (await res.json()) as BlacklistItem
		blacklist.update(items =>
			items.map(i => (i.id === saved.id && i.mediaType === saved.mediaType ? saved : i))
		)
	} catch {
		blacklist.update(items => items.filter(i => !(i.id === item.id && i.mediaType === item.mediaType)))
	}
}

export async function removeFromBlacklist(id: number, mediaType: MediaType): Promise<void> {
	const prev = get(blacklist)
	blacklist.update(items => items.filter(i => !(i.id === id && i.mediaType === mediaType)))

	try {
		const res = await fetch(`/api/blacklist/${id}?type=${mediaType}`, { method: 'DELETE' })
		if (!res.ok && res.status !== 204) throw new Error('Failed to remove')
	} catch {
		blacklist.set(prev)
	}
}

export function filterBlacklisted<T extends { id: number }>(
	items: T[],
	getMediaType: (item: T) => MediaType,
	currentBlacklist: BlacklistItem[]
): T[] {
	if (currentBlacklist.length === 0) return items
	return items.filter(item => !currentBlacklist.some(b => b.id === item.id && b.mediaType === getMediaType(item)))
}
