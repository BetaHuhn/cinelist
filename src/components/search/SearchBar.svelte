<script lang="ts">
	import { onMount } from 'svelte'
	import { page } from '$app/state'
	import { goto } from '$app/navigation'
	import { openDetailPreview } from '$lib/utils/preview'
	import type { TMDBMediaResult, TMDBPerson } from '$lib/types/tmdb'
	import SearchResults from './SearchResults.svelte'

	interface Props {
		placeholder?: string
		class?: string
		resetOnLeaveSearch?: boolean
	}

	let { placeholder = 'Search movies & TV…', class: className = '', resetOnLeaveSearch = false }: Props = $props()

	let query = $state('')
	let mediaResults = $state<TMDBMediaResult[]>([])
	let peopleResults = $state<TMDBPerson[]>([])
	let loading = $state(false)
	let focused = $state(false)
	let open = $state(false)
	let debounceTimer: ReturnType<typeof setTimeout>
	let prevPath = $state<string | null>(null)
	let prevUrlQ = $state<string | null>(null)
	let inputEl = $state<HTMLInputElement | null>(null)
	let selectedIndex = $state(-1)

	const MAX_MEDIA = 8
	const MAX_PEOPLE = 4

	function topMedia(): TMDBMediaResult[] {
		return mediaResults.slice(0, MAX_MEDIA)
	}
	function topPeople(): TMDBPerson[] {
		return peopleResults.slice(0, MAX_PEOPLE)
	}
	function suggestionCount(): number {
		return topMedia().length + topPeople().length
	}

	function fromPath(): string {
		return (page.state as App.PageState | undefined)?.preview?.from
			?? `${page.url.pathname}${page.url.search}${page.url.hash}`
	}

	$effect(() => {
		const currentPath = page.url.pathname
		if (!resetOnLeaveSearch) {
			prevPath = currentPath
			return
		}
		if (prevPath?.startsWith('/search') && !currentPath.startsWith('/search')) {
			close({ clearQuery: true })
		}
		prevPath = currentPath
	})

	// Sync query from URL only when the URL changes (not while the user is typing).
	$effect(() => {
		const q = page.url.searchParams.get('q') ?? ''
		if (q === (prevUrlQ ?? '')) return
		prevUrlQ = q
		if (!q) {
			close({ clearQuery: true })
			return
		}
		query = q
		// On the /search page the results are already rendered below the bar;
		// don't auto-open the suggestions dropdown (it would block clicks on the page).
		if (page.url.pathname.startsWith('/search')) {
			open = false
			mediaResults = []
			peopleResults = []
			loading = false
			clearTimeout(debounceTimer)
			return
		}
		handleInput()
	})

	async function handleInput() {
		clearTimeout(debounceTimer)
		if (!query.trim()) {
			mediaResults = []
			peopleResults = []
			open = false
			selectedIndex = -1
			return
		}
		debounceTimer = setTimeout(async () => {
			loading = true
			try {
				const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
				if (res.ok) {
					const data = (await res.json()) as { media: TMDBMediaResult[]; people: TMDBPerson[] }
					mediaResults = data.media
					peopleResults = data.people
				} else {
					mediaResults = []
					peopleResults = []
				}
				open = mediaResults.length > 0 || peopleResults.length > 0
				selectedIndex = -1
			} catch {
				mediaResults = []
				peopleResults = []
				selectedIndex = -1
			} finally {
				loading = false
			}
		}, 300)
	}

	function close(opts: { clearQuery?: boolean } = {}) {
		open = false
		mediaResults = []
		peopleResults = []
		selectedIndex = -1
		if (opts.clearQuery ?? true) query = ''
	}

	async function submit() {
		const q = query.trim()
		if (!q) return
		open = false
		mediaResults = []
		peopleResults = []
		selectedIndex = -1
		await goto(`/search?q=${encodeURIComponent(q)}`)
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close()
	}

	function handleInputKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			close({ clearQuery: true })
			return
		}

		if (!open || !focused) {
			if (e.key === 'Enter') {
				e.preventDefault()
				submit()
			}
			return
		}

		const count = suggestionCount()
		if (count > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
			e.preventDefault()
			const delta = e.key === 'ArrowDown' ? 1 : -1
			selectedIndex = selectedIndex < 0
				? (delta > 0 ? 0 : count - 1)
				: (selectedIndex + delta + count) % count
			return
		}

		if (e.key === 'Enter') {
			e.preventDefault()
			if (selectedIndex < 0) {
				submit()
				return
			}

			const media = topMedia()
			const people = topPeople()
			if (selectedIndex < media.length) {
				const item = media[selectedIndex]
				const mediaType = item.media_type
				close({ clearQuery: true })
				if (e.shiftKey) {
					openDetailPreview({ mediaType, id: item.id, fromUrl: page.url, fromOverride: fromPath() })
					return
				}
				void goto(mediaType === 'tv' ? `/tv/${item.id}` : `/movie/${item.id}`)
				return
			}

			const personIndex = selectedIndex - media.length
			const person = people[personIndex]
			if (!person) return
			close({ clearQuery: true })
			void goto(`/person/${person.id}`)
			return
		}
	}

	function handleFocusSearchEvent() {
		if (!inputEl) return
		if (inputEl.getClientRects().length === 0) return
		inputEl.focus()
		try {
			inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length)
		} catch {
			// ignore
		}
	}

	onMount(() => {
		const handler: EventListener = () => handleFocusSearchEvent()
		window.addEventListener('cinelist:focus-search', handler)
		return () => window.removeEventListener('cinelist:focus-search', handler)
	})

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault()
		submit()
	}

	function handleFocusIn() {
		focused = true
	}

	function handleFocusOut(e: FocusEvent) {
		const current = e.currentTarget as HTMLElement
		const next = e.relatedTarget as Node | null
		// Keep the dropdown open while focus is still within the search UI
		// (e.g. user clicked a dropdown item).
		if (next && current.contains(next)) return
		focused = false
		close()
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="relative {className}" onfocusin={handleFocusIn} onfocusout={handleFocusOut}>
	<form class="relative z-20" onsubmit={handleSubmit}>
		<svg class="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 pointer-events-none" style="color: var(--color-ink-500)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
		</svg>
		<input
			bind:this={inputEl}
			bind:value={query}
			oninput={handleInput}
			onkeydown={handleInputKeydown}
			type="search"
			{placeholder}
			class="w-full pl-10 {query.trim() ? 'pr-28' : 'pr-4'} py-3 rounded-xl text-sm focus:outline-none transition-all duration-150"
			style="background: color-mix(in srgb, var(--color-surface-700) 60%, transparent); border: 1px solid color-mix(in srgb, var(--color-surface-600) 50%, transparent); color: var(--color-ink-50)"
		/>
		{#if query.trim()}
			<button
				type="submit"
				class="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-lg transition-all duration-150 ease-spring active:scale-95"
				style="background: var(--color-amber-500); color: var(--color-surface-950)"
				aria-label="Search"
			>
				{#if loading}
					<span class="size-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
				{/if}
				<span>Search</span>
			</button>
		{/if}
	</form>

	{#if open && focused}
		<SearchResults {mediaResults} {peopleResults} {selectedIndex} onclose={() => close({ clearQuery: true })} />
	{/if}

	{#if open && focused}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="fixed inset-0 z-10" onclick={() => close({ clearQuery: true })}></div>
	{/if}
</div>
