import { writable } from 'svelte/store'
import type { Toast } from '$lib/types/app'

export const searchOpen = writable(false)

export const toasts = writable<Toast[]>([])

export function addToast(message: string, type: Toast['type'] = 'info', duration = 3000): void {
	const id = Math.random().toString(36).slice(2)
	toasts.update(t => [...t, { id, message, type }])
	setTimeout(() => {
		toasts.update(t => t.filter(toast => toast.id !== id))
	}, duration)
}

export function removeToast(id: string): void {
	toasts.update(t => t.filter(toast => toast.id !== id))
}
