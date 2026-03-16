import { writable } from 'svelte/store'
import type { MediaType } from '$lib/types/app'

export interface ContextMenuData {
	x: number
	y: number
	mediaType: MediaType
	id: number
	title: string
	poster_path: string | null
	backdrop_path: string | null
	release_date: string
	vote_average: number
	genre_ids: number[]
	href: string
}

interface ContextMenuState extends ContextMenuData {
	open: boolean
}

const defaultState: ContextMenuState = {
	open: false,
	x: 0,
	y: 0,
	mediaType: 'movie',
	id: 0,
	title: '',
	poster_path: null,
	backdrop_path: null,
	release_date: '',
	vote_average: 0,
	genre_ids: [],
	href: ''
}

export const contextMenu = writable<ContextMenuState>(defaultState)

export function openContextMenu(data: ContextMenuData): void {
	contextMenu.set({ ...data, open: true })
}

export function closeContextMenu(): void {
	contextMenu.update(s => ({ ...s, open: false }))
}
