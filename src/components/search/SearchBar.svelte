<script lang="ts">
	import { page } from '$app/state'
	import { goto } from '$app/navigation'
	import { searchMulti, searchPeople } from '$lib/api/tmdb'
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
			return
		}
		debounceTimer = setTimeout(async () => {
			loading = true
			try {
				const [media, people] = await Promise.all([
					searchMulti(query),
					searchPeople(query)
				])
				mediaResults = media
				peopleResults = people
				open = mediaResults.length > 0 || peopleResults.length > 0
			} catch {
				mediaResults = []
				peopleResults = []
			} finally {
				loading = false
			}
		}, 300)
	}

	function close(opts: { clearQuery?: boolean } = {}) {
		open = false
		mediaResults = []
		peopleResults = []
		if (opts.clearQuery ?? true) query = ''
	}

	async function submit() {
		const q = query.trim()
		if (!q) return
		open = false
		mediaResults = []
		peopleResults = []
		await goto(`/search?q=${encodeURIComponent(q)}`)
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close()
	}

	function handleInputKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault()
			submit()
		}
	}

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
		<SearchResults {mediaResults} {peopleResults} onclose={() => close({ clearQuery: true })} />
	{/if}

	{#if open && focused}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="fixed inset-0 z-10" onclick={() => close({ clearQuery: true })}></div>
	{/if}
</div>
