import { storage } from '$storage'
import type { FavoritePerson } from '$lib/types/app'

const PREFIX = 'people'
const key = (id: number) => `${PREFIX}:${id}`


function toFiniteNumber(value: unknown): number | null {
	const n = typeof value === 'number' ? value : Number(value)
	return Number.isFinite(n) ? n : null
}

function normalize(person: FavoritePerson | null): FavoritePerson | null {
	if (!person) return null

	const id = toFiniteNumber((person as any).id)
	if (!id || id <= 0) return null

	const name = typeof (person as any).name === 'string' ? (person as any).name.trim() : ''
	if (!name) return null

	const addedAt = toFiniteNumber((person as any).addedAt) ?? 0

	return {
		id,
		name,
		profile_path: typeof (person as any).profile_path === 'string' ? (person as any).profile_path : null,
		known_for_department:
			typeof (person as any).known_for_department === 'string' ? (person as any).known_for_department : null,
		addedAt
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

/** Returns a Map from person ID → person name for all favorited people. */
export async function getFavoritePeopleMap(): Promise<Map<number, string>> {
	const people = await getFavoritePeople()
	return new Map(people.map(p => [p.id, p.name]))
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
