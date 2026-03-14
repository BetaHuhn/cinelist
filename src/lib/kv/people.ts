import { storage } from '$storage'
import type { FavoritePerson } from '$lib/types/app'

const PREFIX = 'people'
const key = (id: number) => `${PREFIX}:${id}`

function normalize(person: FavoritePerson | null): FavoritePerson | null {
	if (!person) return null
	return {
		id: person.id,
		name: person.name,
		profile_path: person.profile_path ?? null,
		known_for_department: person.known_for_department ?? null,
		addedAt: person.addedAt
	}
}

export async function getFavoritePeople(): Promise<FavoritePerson[]> {
	const keys = await storage.getKeys(PREFIX)
	const raw = await Promise.all(keys.map(k => storage.getItem<FavoritePerson>(k)))
	return raw
		.map(p => normalize(p))
		.filter(Boolean)
		.sort((a, b) => (b as FavoritePerson).addedAt - (a as FavoritePerson).addedAt) as FavoritePerson[]
}

export async function getFavoritePerson(id: number): Promise<FavoritePerson | null> {
	const item = await storage.getItem<FavoritePerson>(key(id))
	return normalize(item)
}

export async function addFavoritePerson(
	person: Omit<FavoritePerson, 'addedAt'>
): Promise<FavoritePerson> {
	const full: FavoritePerson = {
		...person,
		addedAt: Date.now(),
		known_for_department: person.known_for_department ?? null,
		profile_path: person.profile_path ?? null
	}
	await storage.setItem(key(person.id), full)
	return full
}

export async function removeFavoritePerson(id: number): Promise<void> {
	await storage.removeItem(key(id))
}
