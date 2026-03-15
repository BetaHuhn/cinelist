<script lang="ts">
	import { scale } from 'svelte/transition'
	import { elasticOut } from 'svelte/easing'
	import { watchlist, addToWatchlist, removeFromWatchlist, toggleMediaServer } from '$lib/stores/watchlist'
	import { addToast } from '$lib/stores/ui'
	import type { TMDBMedia } from '$lib/types/tmdb'

	interface Props {
		media: TMDBMedia
		size?: 'sm' | 'md' | 'lg'
		showLabel?: boolean
	}

	let { media, size = 'md', showLabel = false }: Props = $props()

	let loading = $state(false)
	let pointerDown = $state(false)
	let showingHold = $state(false)
	let progress = $state(0) // 0–1
	let pressTimer: ReturnType<typeof setTimeout> | null = null
	let showHoldTimer: ReturnType<typeof setTimeout> | null = null
	let rafId: number | null = null
	let pressStart = 0

	const HOLD_MS = 1000
	const SHOW_HOLD_AFTER_MS = 150

	const mediaType = $derived('title' in media ? 'movie' : 'tv')
	const item = $derived($watchlist.find(i => i.id === media.id && i.mediaType === mediaType))
	const inList = $derived(item !== undefined)
	const onServer = $derived(item?.onMediaServer ?? false)

	const iconOnlySizes = { sm: 'size-8 text-sm', md: 'size-10 text-base', lg: 'size-12 text-lg' }

	// Three-state colors: unsaved → amber → green
	const activeColor = $derived(onServer ? '#4ade80' : 'var(--color-amber-500)')
	const idleColor = 'color-mix(in srgb, var(--color-surface-600) 50%, transparent)'

	const borderBg = $derived(
		showingHold && progress > 0
			? `conic-gradient(${activeColor} ${progress * 360}deg, ${idleColor} 0deg)`
			: onServer ? '#4ade80'
			: inList  ? 'var(--color-amber-500)'
			:            idleColor
	)

	const iconColor = $derived(
		onServer ? '#4ade80'
		: inList ? 'var(--color-amber-500)'
		:          'var(--color-ink-300)'
	)

	const label = $derived(onServer ? 'Saved in Library' : inList ? 'Saved' : 'Save')
	const icon  = $derived(inList ? '★' : '☆')

	function raf() {
		if (!pointerDown) return
		progress = Math.min((Date.now() - pressStart) / HOLD_MS, 1)
		rafId = requestAnimationFrame(raf)
	}

	function startPress(e: PointerEvent) {
		if (loading) return
		e.preventDefault()
		;(e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId)
		pointerDown = true
		showingHold = false
		progress = 0
		pressStart = Date.now()
		rafId = requestAnimationFrame(raf)
		showHoldTimer = setTimeout(() => {
			// Only show the hold animation if the user is actually holding
			if (pointerDown && !loading) showingHold = true
		}, SHOW_HOLD_AFTER_MS)
		pressTimer = setTimeout(async () => {
			pointerDown = false
			showingHold = false
			if (rafId) { cancelAnimationFrame(rafId); rafId = null }
			if (showHoldTimer) { clearTimeout(showHoldTimer); showHoldTimer = null }
			pressTimer = null
			progress = 1
			await handleLongPress()
			setTimeout(() => { progress = 0 }, 400)
		}, HOLD_MS)
	}

	function abort() {
		if (!pointerDown) return
		pointerDown = false
		showingHold = false
		progress = 0
		if (rafId) { cancelAnimationFrame(rafId); rafId = null }
		if (pressTimer) { clearTimeout(pressTimer); pressTimer = null }
		if (showHoldTimer) { clearTimeout(showHoldTimer); showHoldTimer = null }
	}

	async function endPress(e: PointerEvent) {
		if (!pointerDown) return
		const completed = progress >= 0.99
		abort()
		e.stopPropagation()
		if (!completed) await handleShortPress()
	}

	async function handleShortPress() {
		if (loading) return
		loading = true
		try {
			if (inList) {
				await removeFromWatchlist(media.id, mediaType)
				addToast('Removed from watchlist', 'info')
			} else {
				await addToWatchlist(media)
				addToast('Added to watchlist', 'success')
			}
		} catch {
			addToast('Something went wrong', 'error')
		} finally {
			loading = false
		}
	}

	async function handleLongPress() {
		if (loading) return
		loading = true
		try {
			if (!inList) await addToWatchlist(media)
			const current = $watchlist.find(i => i.id === media.id && i.mediaType === mediaType)
			if (current && !current.onMediaServer) await toggleMediaServer(media.id, mediaType)
			addToast('Saved to watchlist & marked as saved in library', 'success')
		} catch {
			addToast('Something went wrong', 'error')
		} finally {
			loading = false
		}
	}

	// Imperative API for keyboard shortcuts (bind:this on the component)
	export function keyboardPressStart(): void {
		if (loading) return
		if (pointerDown) return
		pointerDown = true
		showingHold = false
		progress = 0
		pressStart = Date.now()
		rafId = requestAnimationFrame(raf)
		showHoldTimer = setTimeout(() => {
			if (pointerDown && !loading) showingHold = true
		}, SHOW_HOLD_AFTER_MS)
		pressTimer = setTimeout(async () => {
			pointerDown = false
			showingHold = false
			if (rafId) { cancelAnimationFrame(rafId); rafId = null }
			if (showHoldTimer) { clearTimeout(showHoldTimer); showHoldTimer = null }
			pressTimer = null
			progress = 1
			await handleLongPress()
			setTimeout(() => { progress = 0 }, 400)
		}, HOLD_MS)
	}

	export async function keyboardPressEnd(): Promise<void> {
		// If long-press already fired, `pointerDown` is false.
		if (!pointerDown) return
		const completed = progress >= 0.99
		abort()
		if (!completed) await handleShortPress()
	}

	export function keyboardPressAbort(): void {
		abort()
	}
</script>

<div
	class="rounded-full transition-transform duration-150 ease-in-out hover:scale-105"
	style="padding: 2px; background: {borderBg}"
>
	<button
		onpointerdown={startPress}
		onpointerup={endPress}
		onpointercancel={abort}
		oncontextmenu={(e) => e.preventDefault()}
		disabled={loading}
		aria-label={label}
		class="flex items-center justify-center gap-2 rounded-full active:scale-95 disabled:opacity-50 {showLabel ? 'px-4 py-2.5 text-sm' : iconOnlySizes[size]}"
		style="background: color-mix(in srgb, var(--color-surface-900) 95%, transparent); backdrop-filter: blur(4px)"
	>
		{#key inList}
			<span in:scale={{ duration: 300, easing: elasticOut }} style="color: {iconColor}">
				{icon}
			</span>
		{/key}
		{#if showLabel}
			<span class="font-medium" style="color: var(--color-ink-100)">{label}</span>
		{/if}
	</button>
</div>
