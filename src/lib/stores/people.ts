import { writable, get } from 'svelte/store'
import type { FavoritePerson } from '$lib/types/app'

export const favoritePeople = writable<FavoritePerson[]>([])
export const favoritePeopleLoaded = writable(false)

export async function loadFavoritePeople(): Promise<void> {
	try {
		const res = await fetch('/api/people')
		if (!res.ok) throw new Error('Failed')
		const items = (await res.json()) as FavoritePerson[]
		favoritePeople.set(Array.isArray(items) ? items : [])
	} catch {
		favoritePeople.set([])
	} finally {
		favoritePeopleLoaded.set(true)
	}
}

export function isFavoritePerson(id: number): boolean {
	return get(favoritePeople).some(p => p.id === id)
}

export async function addPersonToFavorites(person: Omit<FavoritePerson, 'addedAt'>): Promise<void> {
	const res = await fetch('/api/people', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(person)
	})
	if (!res.ok) throw new Error('Failed')
	const created = (await res.json()) as FavoritePerson
	favoritePeople.update(items => {
		const next = [created, ...items.filter(i => i.id !== created.id)]
		return next.sort((a, b) => b.addedAt - a.addedAt)
	})
}

export async function removePersonFromFavorites(id: number): Promise<void> {
	const res = await fetch(`/api/people/${id}`, { method: 'DELETE' })
	if (!res.ok) throw new Error('Failed')
	favoritePeople.update(items => items.filter(i => i.id !== id))
}

export async function toggleFavoritePerson(person: Omit<FavoritePerson, 'addedAt'>): Promise<void> {
	const exists = isFavoritePerson(person.id)
	if (exists) return removePersonFromFavorites(person.id)
	return addPersonToFavorites(person)
}
