import { writable } from 'svelte/store'
import { browser } from '$app/environment'

export interface NavEntry {
	type: 'movie' | 'tv' | 'person'
	id: number
	title: string
	posterPath: string | null
	href: string
}

const MAX_ENTRIES = 10
const STORAGE_KEY = 'cinelist:navHistory'

function loadFromStorage(): NavEntry[] {
	if (!browser) return []
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY)
		if (!raw) return []
		const parsed: unknown = JSON.parse(raw)
		if (!Array.isArray(parsed)) return []
		return parsed as NavEntry[]
	} catch {
		return []
	}
}

function createNavHistoryStore() {
	const { subscribe, set, update } = writable<NavEntry[]>(loadFromStorage())

	if (browser) {
		subscribe((entries) => {
			try {
				sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
			} catch {
				// sessionStorage may be unavailable (e.g. private mode quota exceeded)
			}
		})
	}

	return {
		subscribe,

		/**
		 * Push a new entry onto the trail.
		 *
		 * - If the top entry is already this item, it's a no-op (page re-render).
		 * - If the item already exists earlier in the trail, the trail is truncated
		 *   at that point (the user went back and is re-exploring from there).
		 * - Otherwise the entry is appended, capped at MAX_ENTRIES.
		 */
		push(entry: NavEntry) {
			update((entries) => {
				const top = entries[entries.length - 1]
				if (top && top.type === entry.type && top.id === entry.id) {
					// Same page; update title/poster in case they changed
					return [...entries.slice(0, -1), { ...top, ...entry }]
				}

				const existingIdx = entries.findLastIndex(
					(e) => e.type === entry.type && e.id === entry.id
				)
				if (existingIdx !== -1) {
					// User navigated back to a previous stop – trim forward history and
					// refresh that entry's metadata (title/poster may have changed)
					return [
						...entries.slice(0, existingIdx),
						{ ...entries[existingIdx], ...entry }
					]
				}

				const next = [...entries, entry]
				return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next
			})
		},

		clear() {
			set([])
		}
	}
}

export const navHistory = createNavHistoryStore()
