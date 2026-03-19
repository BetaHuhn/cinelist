<script lang="ts">
	import { scale } from 'svelte/transition'
	import { elasticOut } from 'svelte/easing'
	import {
		watchlist,
		addToWatchlist,
		removeFromWatchlist,
		toggleMediaServer,
		toggleWatched
	} from '$lib/stores/watchlist'
	import { addToast } from '$lib/stores/ui'
	import type { TMDBMedia } from '$lib/types/tmdb'

	interface Props {
		media: TMDBMedia
		size?: 'sm' | 'md' | 'lg'
		minimal?: boolean
		hideLabel?: boolean
		hideDropdown?: boolean
		hideTooltip?: boolean
	}

	let {
		media,
		size = 'md',
		minimal = false,
		hideLabel = false,
		hideDropdown = false,
		hideTooltip = false
	}: Props = $props()

	let loading = $state(false)
	let pointerDown = $state(false)
	let showingHold = $state(false)
	let menuOpen = $state(false)
	let focused = $state(false)
	let tooltipVisible = $state(false)
	let progress = $state(0) // 0–1
	let pressTimer: ReturnType<typeof setTimeout> | null = null
	let showHoldTimer: ReturnType<typeof setTimeout> | null = null
	let tooltipTimer: ReturnType<typeof setTimeout> | null = null
	let rafId: number | null = null
	let pressStart = 0
	let rootEl: HTMLDivElement | null = null
	let widthResetTimer: ReturnType<typeof setTimeout> | null = null
	let prevWidth = 0
	let lastWidthKey = ''
	let animatedWidth = $state<number | null>(null)

	const HOLD_MS = 1000
	const SHOW_HOLD_AFTER_MS = 150
	const TOOLTIP_DELAY_MS = 1000
	const WIDTH_TRANSITION_MS = 200

	const mediaType = $derived('title' in media ? 'movie' : 'tv')
	const item = $derived($watchlist.find(i => i.id === media.id && i.mediaType === mediaType))
	const inList = $derived(item !== undefined)
	const onServer = $derived(item?.onMediaServer ?? false)
	const watched = $derived(item?.watched ?? false)

	type ButtonState = 'none' | 'watchlist' | 'ready' | 'watched'
	const buttonState = $derived<ButtonState>(
		!inList ? 'none'
		: watched ? 'watched'
		: onServer ? 'ready'
		: 'watchlist'
	)

	const iconOnlySizes = { sm: 'size-4 text-xs p-1', md: 'size-6 text-sm', lg: 'size-12 text-lg' }
	const labelSizes = { sm: 'text-xs px-2 py-1 gap-1', md: 'text-sm px-4 py-2.5 gap-1', lg: 'text-base px-4 py-2 gap-2' }

	// Colors: none → neutral, watchlist → amber, ready/watched → green
	const baseActiveColor = $derived(
		buttonState === 'ready' || buttonState === 'watched'
			? '#4ade80'
			: buttonState === 'watchlist'
				? 'var(--color-amber-500)'
				: 'color-mix(in srgb, var(--color-surface-600) 50%, transparent)'
	)
	const activeColor = $derived(
		minimal
			? `color-mix(in srgb, ${baseActiveColor} 55%, var(--color-surface-600))`
			: baseActiveColor
	)
	const idleColor = 'color-mix(in srgb, var(--color-surface-600) 50%, transparent)'
	const holdRingColor = $derived(
		pointerDown && buttonState === 'none'
			? 'var(--color-amber-500)'
			: activeColor
	)
	const holdIsDowngrade = $derived(buttonState === 'ready' || buttonState === 'watched')
	const holdProgress = $derived(holdIsDowngrade ? Math.max(0, 1 - progress) : progress)

	const borderBg = $derived(
		showingHold && progress > 0
			? `conic-gradient(${holdRingColor} ${holdProgress * 360}deg, ${idleColor} 0deg)`
			: pointerDown && buttonState === 'none'
				? holdRingColor
			: buttonState === 'ready' || buttonState === 'watched'
				? '#4ade80'
				: buttonState === 'watchlist'
					? 'var(--color-amber-500)'
					: idleColor
	)

	const baseIconColor = $derived(
		buttonState === 'ready' || buttonState === 'watched'
			? '#4ade80'
			: buttonState === 'watchlist'
				? 'var(--color-amber-500)'
				: 'var(--color-ink-300)'
	)
	const iconColor = $derived(
		minimal
			? `color-mix(in srgb, ${baseIconColor} 60%, var(--color-ink-300))`
			: baseIconColor
	)

	const chromeBg = $derived(
		minimal
			? 'color-mix(in srgb, var(--color-surface-900) 98%, transparent)'
			: 'color-mix(in srgb, var(--color-surface-900) 95%, transparent)'
	)
	const chromeBlur = $derived(minimal ? 'blur(0px)' : 'blur(4px)')

	const label = $derived(
		buttonState === 'none' ? 'Save to Watchlist'
		: buttonState === 'watchlist' ? 'On Watchlist'
		: buttonState === 'ready' ? 'On Watchlist'
		: 'Watched'
	)
	const icon = $derived(buttonState === 'watched' ? '✓' : buttonState === 'none' ? '☆' : '★')

	const clickHint = $derived(
		buttonState === 'none' ? 'Save to watchlist'
		: buttonState === 'watchlist' ? 'Remove from watchlist'
		: buttonState === 'ready' ? 'Mark as watched'
		: 'Mark as ready to watch'
	)
	const holdHint = $derived(
		buttonState === 'none' ? 'Save to watchlist & mark as ready'
		: buttonState === 'watchlist' ? 'Mark as watched'
		: buttonState === 'ready' ? 'Remove from watchlist'
		: 'Remove from watchlist'
	)

	function raf() {
		if (!pointerDown) return
		progress = Math.min((Date.now() - pressStart) / HOLD_MS, 1)
		rafId = requestAnimationFrame(raf)
	}

	function startPress(e: PointerEvent) {
		if (loading) return
		if (menuOpen) return
		keyboardIntent = 'default'
		hideTooltipFn()
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

	function showTooltipDelayed() {
		if (tooltipTimer) clearTimeout(tooltipTimer)
		tooltipTimer = setTimeout(() => {
			tooltipVisible = true
			tooltipTimer = null
		}, TOOLTIP_DELAY_MS)
	}

	function hideTooltipFn() {
		if (tooltipTimer) {
			clearTimeout(tooltipTimer)
			tooltipTimer = null
		}
		tooltipVisible = false
	}

	const widthKey = $derived(`${hideLabel}-${label}`)

	$effect.pre(() => {
		widthKey
		if (!rootEl) return
		prevWidth = rootEl.getBoundingClientRect().width
	})

	$effect(() => {
		widthKey
		if (!rootEl) return
		if (!lastWidthKey) {
			lastWidthKey = widthKey
			return
		}
		if (widthKey === lastWidthKey) return
		lastWidthKey = widthKey

		if (widthResetTimer) {
			clearTimeout(widthResetTimer)
			widthResetTimer = null
		}

		const nextWidth = rootEl.getBoundingClientRect().width
		animatedWidth = prevWidth
		requestAnimationFrame(() => {
			animatedWidth = nextWidth
			widthResetTimer = setTimeout(() => {
				animatedWidth = null
				widthResetTimer = null
			}, WIDTH_TRANSITION_MS)
		})
	})

	async function endPress(e: PointerEvent) {
		if (!pointerDown) return
		const completed = progress >= 0.99
		abort()
		e.stopPropagation()
		if (!completed) await handleShortPress()
	}

	async function ensureInList(): Promise<void> {
		if (!inList) await addToWatchlist(media)
	}

	async function ensureOnServer(next: boolean): Promise<void> {
		const current = $watchlist.find(i => i.id === media.id && i.mediaType === mediaType)
		if (!current) return
		if (Boolean(current.onMediaServer) !== next) {
			await toggleMediaServer(media.id, mediaType)
		}
	}

	async function ensureWatched(next: boolean): Promise<void> {
		const current = $watchlist.find(i => i.id === media.id && i.mediaType === mediaType)
		if (!current) return
		if (Boolean(current.watched) !== next) {
			await toggleWatched(media.id, mediaType)
		}
	}

	async function setState(next: ButtonState): Promise<void> {
		if (loading) return
		loading = true
		try {
			if (next === 'none') {
				if (inList) {
					await removeFromWatchlist(media.id, mediaType)
					addToast('Removed from watchlist', 'success')
				}
				return
			}

			if (next === 'watchlist' && buttonState === 'ready') {
				await ensureInList()
				await ensureWatched(false)
				await ensureOnServer(false)
				addToast('Marked as not ready to watch', 'success')
				return
			}
			if (next === 'watchlist') {
				await ensureInList()
				await ensureWatched(false)
				await ensureOnServer(false)
				addToast('Added to watchlist', 'success')
				return
			}
			if (buttonState === 'watched' && next === 'ready') {
				await ensureInList()
				await ensureWatched(false)
				await ensureOnServer(true)
				addToast('Marked as unwatched', 'success')
				return
			}
			if (next === 'ready' && inList) {
				await ensureInList()
				await ensureWatched(false)
				await ensureOnServer(true)
				addToast('Marked as ready to watch', 'success')
				return
			}
			if (next === 'ready' && !inList) {
				await ensureInList()
				await ensureWatched(false)
				await ensureOnServer(true)
				addToast('Added to watchlist ready to watch', 'success')
				return
			}
			if (!inList) {
				await ensureInList()
				await ensureWatched(true)
				addToast('Added to watchlist and marked as watched', 'success')
				return
			}

			// watched
			await ensureInList()
			await ensureWatched(true)
			addToast('Marked as watched', 'success')
		} catch {
			addToast('Something went wrong', 'error')
		} finally {
			loading = false
		}
	}

	async function handleShortPress() {
		if (loading) return
		if (buttonState === 'none') return setState('watchlist')
		if (buttonState === 'watchlist') return setState('none')
		if (buttonState === 'ready') return setState('watched')
		// watched
		return (async () => {
			loading = true
			try {
				// Watched -> On Watchlist and ready to watch
				await ensureInList()
				await ensureWatched(false)
				await ensureOnServer(true)
				addToast('Marked as unwatched', 'success')
			} catch {
				addToast('Something went wrong', 'error')
			} finally {
				loading = false
			}
		})()
	}

	async function handleLongPress() {
		if (loading) return
		if (buttonState === 'none') return setState('ready')
		if (buttonState === 'watchlist') return setState('ready')
		if (buttonState === 'ready') return setState('none')
		// watched
		return setState('none')
	}

	type KeyboardIntent = 'default' | 'watchlist' | 'ready' | 'watched'
	let keyboardIntent: KeyboardIntent = 'default'

	async function keyboardToggleWatchlist(): Promise<void> {
		if (loading) return
		if (!inList) return setState('watchlist')
		return setState('none')
	}

	async function keyboardToggleReady(): Promise<void> {
		if (loading) return
		if (buttonState === 'ready') return setState('watchlist')
		return setState('ready')
	}

	async function keyboardToggleWatched(): Promise<void> {
		if (loading) return
		if (!inList) return setState('watched')
		if (buttonState === 'watched') {
			loading = true
			try {
				await ensureInList()
				await ensureWatched(false)
				addToast('Marked as unwatched', 'success')
			} catch {
				addToast('Something went wrong', 'error')
			} finally {
				loading = false
			}
			return
		}
		return setState('watched')
	}

	// Imperative API for keyboard shortcuts (bind:this on the component)
	export function keyboardPressStart(intent: KeyboardIntent = 'default'): void {
		if (loading) return
		if (pointerDown) return
		keyboardIntent = intent
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
		const intent = keyboardIntent
		keyboardIntent = 'default'
		abort()
		if (completed) return
		if (intent === 'watchlist') return keyboardToggleWatchlist()
		if (intent === 'ready') return keyboardToggleReady()
		if (intent === 'watched') return keyboardToggleWatched()
		return handleShortPress()
	}

	export function keyboardPressAbort(): void {
		keyboardIntent = 'default'
		abort()
	}

	function handleFocusIn() {
		focused = true
		showTooltipDelayed()
	}

	function handleFocusOut(e: FocusEvent) {
		const current = e.currentTarget as HTMLElement
		const next = e.relatedTarget as Node | null
		if (next && current.contains(next)) return
		focused = false
		menuOpen = false
		hideTooltipFn()
	}

	function toggleMenu(e: MouseEvent) {
		e.preventDefault()
		e.stopPropagation()
		if (loading) return
		hideTooltipFn()
		menuOpen = !menuOpen
	}

	async function choose(next: ButtonState, e: MouseEvent) {
		e.preventDefault()
		e.stopPropagation()
		menuOpen = false
		await setState(next)
	}

	function stopClick(e: MouseEvent) {
		// This component is often rendered inside a link/card.
		// Always suppress the synthetic click so it can't trigger navigation.
		e.preventDefault()
		e.stopPropagation()
	}
</script>

<div
	bind:this={rootEl}
	class="relative inline-flex items-center rounded-full transition-transform duration-150 ease-in-out group"
	role="group"
	aria-label="Watchlist state"
	style="padding: 2px; background: {borderBg}; width: {animatedWidth ? `${animatedWidth}px` : 'auto'}; transition: width {WIDTH_TRANSITION_MS}ms ease"
	onmouseenter={showTooltipDelayed}
	onmouseleave={hideTooltipFn}
	onfocusin={handleFocusIn}
	onfocusout={handleFocusOut}
>
	<div
		class="flex items-center rounded-full overflow-hidden w-full transition-colors ease-in-out {minimal ? 'group-hover:bg-surface-900!' : 'group-hover:bg-surface-700!'}"
		style="background: {chromeBg}; backdrop-filter: {chromeBlur}"
	>
		<button
			onpointerdown={startPress}
			onpointerup={endPress}
			onpointercancel={abort}
			onclick={stopClick}
			oncontextmenu={(e) => e.preventDefault()}
			disabled={loading}
			aria-label={label}
			class="flex items-center justify-center rounded-full select-none disabled:opacity-50 {hideLabel ? iconOnlySizes[size] : labelSizes[size]}"
			style="background: transparent"
		>
			<span in:scale={{ duration: 300, easing: elasticOut }} style="color: {iconColor}">
				{icon}
			</span>
			{#if !hideLabel}
				<span class="font-medium whitespace-nowrap" style="color: var(--color-ink-100)">{label}</span>
			{/if}
		</button>

		<!-- Separate hit area for dropdown (prevents long-press from competing) -->
		{#if !hideDropdown}
			<button
				onclick={toggleMenu}
				aria-label="Change watchlist state"
				class="pl-1 pr-3"
				style="background: transparent; color: var(--color-ink-500)"
			>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transition-transform ease-in-out size-5" style="transform: rotate({menuOpen ? 180 : 0}deg)"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 9l6 6l6 -6" /></svg>
			</button>
		{/if}
	</div>

	<!-- Tooltip -->
	{#if !hideTooltip}
		<div
			class="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 w-max max-w-[320px] transition-opacity duration-150"
			style="z-index: 30; opacity: {tooltipVisible && !menuOpen ? 1 : 0}"
		>
			<div class="px-3 py-2 rounded-lg text-xs" style="background: color-mix(in srgb, var(--color-surface-900) 92%, transparent); border: 1px solid var(--color-surface-400); color: var(--color-ink-100)">
				<div><span style="color: var(--color-ink-500)">Click:</span> {clickHint}</div>
				<div><span style="color: var(--color-ink-500)">Click & Hold:</span> {holdHint}</div>
			</div>
		</div>
	{/if}

	<!-- Dropdown menu -->
	{#if !hideDropdown && menuOpen && (focused || menuOpen)}
		<div
			class="absolute right-0 top-full mt-2 rounded-xl overflow-hidden w-fit"
			style="z-index: 40; background: var(--color-surface-800); border: 1px solid var(--color-surface-400)"
		>
			<button class="text-left px-3 py-2 text-sm w-full min-w-max transition-colors ease-in-out hover:bg-surface-700" style="color: var(--color-ink-100)" onclick={(e) => choose('none', e)}>
				<span style="color: var(--color-ink-500)">☆</span> Not saved
			</button>
			<button class="text-left px-3 py-2 text-sm w-full min-w-max transition-colors ease-in-out hover:bg-surface-700" style="color: var(--color-ink-100)" onclick={(e) => choose('watchlist', e)}>
				<span style="color: var(--color-amber-500)">★</span> On Watchlist
			</button>
			<button class="text-left px-3 py-2 text-sm w-full min-w-max transition-colors ease-in-out hover:bg-surface-700" style="color: var(--color-ink-100)" onclick={(e) => choose('ready', e)}>
				<span style="color: var(--color-emerald-500)">★</span> Ready to watch
			</button>
			<button class="text-left px-3 py-2 text-sm w-full min-w-max transition-colors ease-in-out hover:bg-surface-700" style="color: var(--color-ink-100)" onclick={(e) => choose('watched', e)}>
				<span style="color: var(--color-emerald-500)">✓</span> Watched
			</button>
		</div>
	{/if}
</div>
