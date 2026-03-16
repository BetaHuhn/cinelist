import { writable } from 'svelte/store'

export interface PersonContextMenuData {
	x: number
	y: number
	id: number
	name: string
	profile_path: string | null
	known_for_department: string | null
	href: string
}

interface PersonContextMenuState extends PersonContextMenuData {
	open: boolean
}

const defaultState: PersonContextMenuState = {
	open: false,
	x: 0,
	y: 0,
	id: 0,
	name: '',
	profile_path: null,
	known_for_department: null,
	href: ''
}

export const personContextMenu = writable<PersonContextMenuState>(defaultState)

export function openPersonContextMenu(data: PersonContextMenuData): void {
	personContextMenu.set({ ...data, open: true })
}

export function closePersonContextMenu(): void {
	personContextMenu.update(s => ({ ...s, open: false }))
}
