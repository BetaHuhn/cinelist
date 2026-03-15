<script lang="ts">
	import { fade, scale } from 'svelte/transition'
	import { page } from '$app/state'
	import { goto } from '$app/navigation'
	import { isEditableTarget } from '$lib/utils/keyboard'
	import Spinner from '$components/ui/Spinner.svelte'
	import MovieDetailView from '$components/detail/MovieDetailView.svelte'
	import TVDetailView from '$components/detail/TVDetailView.svelte'
	import type { MovieDetail, TVDetail } from '$lib/types/app'

	let loading = $state(false)
	let errorMessage = $state<string | null>(null)
	let movie = $state<MovieDetail | null>(null)
	let tv = $state<TVDetail | null>(null)
	let lastKey: string | null = null

	const preview = $derived((page.state as App.PageState | undefined)?.preview ?? null)
	const open = $derived(preview !== null)

	function close() {
		if (!open) return
		history.back()
	}

	async function expand() {
		if (!preview) return

		const href = preview.mediaType === 'tv' ? `/tv/${preview.id}` : `/movie/${preview.id}`
		await goto(href, { replaceState: true, state: {} })

		// `openDetailPreview` uses `pushState`, so the URL may already be `href` without an actual navigation.
		// If we're still in preview mode after `goto`, force a navigation by first replacing the history entry.
		if ((page.state as App.PageState | undefined)?.preview) {
			const from = preview.from ?? '/'
			history.replaceState({}, '', from)
			await goto(href, { replaceState: true, state: {} })
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!open) return
		if (e.repeat) return
		if (isEditableTarget(e.target)) return
		if (e.key === 'Escape') close()
		if (e.key === 'Enter' || e.key.toLowerCase() === 'o') {
			e.preventDefault()
			void expand()
		}
	}

	$effect(() => {
		if (!preview) {
			loading = false
			errorMessage = null
			movie = null
			tv = null
			lastKey = null
			return
		}

		const key = `${preview.mediaType}:${preview.id}`
		if (lastKey === key) return
		lastKey = key

		loading = true
		errorMessage = null
		movie = null
		tv = null

		const ac = new AbortController()

		const activeKey = key
		;(async () => {
			const endpoint = preview.mediaType === 'movie'
				? `/api/detail/movie/${preview.id}`
				: `/api/detail/tv/${preview.id}`
			const res = await fetch(endpoint, { signal: ac.signal })
			if (!res.ok) throw new Error(`Failed to load details (${res.status})`)
			const data = await res.json() as { movie?: MovieDetail; tv?: TVDetail }
			if (preview.mediaType === 'movie') {
				movie = data.movie ?? null
			} else {
				tv = data.tv ?? null
			}
		})()
			.catch((err: unknown) => {
				if (ac.signal.aborted) return
				if (lastKey !== activeKey) return
				errorMessage = err instanceof Error ? err.message : 'Failed to load details'
			})
			.finally(() => {
				if (ac.signal.aborted) return
				if (lastKey !== activeKey) return
				loading = false
			})

		return () => ac.abort()
	})
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
		style="background: color-mix(in srgb, var(--color-surface-950) 20%, transparent); backdrop-filter: blur(10px)"
		in:fade={{ duration: 200 }}
		out:fade={{ duration: 150 }}
		onclick={close}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="relative w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl"
			style="background: var(--color-surface-900)"
			in:scale={{ duration: 250, start: 0.97 }}
			onclick={(e) => e.stopPropagation()}
		>
			<div class="max-h-[90dvh] overflow-y-auto">
				{#if loading}
					<div class="p-10 flex items-center justify-center">
						<Spinner size="lg" />
					</div>
				{:else if errorMessage}
					<div class="p-8">
						<h2 class="text-lg font-semibold" style="color: var(--color-ink-100)">Couldn’t load details</h2>
						<p class="text-sm mt-2" style="color: var(--color-ink-500)">{errorMessage}</p>
						{#if preview}
							<a
								href={preview.mediaType === 'tv' ? `/tv/${preview.id}` : `/movie/${preview.id}`}
								class="btn-primary inline-flex mt-4"
							>
								Open detail page
							</a>
						{/if}
					</div>
				{:else if movie}
					<MovieDetailView {movie} />
				{:else if tv}
					<TVDetailView {tv} />
				{/if}
			</div>

			<div class="absolute top-3 right-3 flex items-center gap-2">
				<button
					onclick={expand}
					class="size-9 flex items-center justify-center rounded-full transition-colors"
					style="background: color-mix(in srgb, var(--color-surface-950) 80%, transparent); backdrop-filter: blur(4px); color: var(--color-ink-300)"
					aria-label="Open detail page"
					title="Open detail page"
				>↗</button>
				<button
					onclick={close}
					class="size-9 flex items-center justify-center rounded-full transition-colors"
					style="background: color-mix(in srgb, var(--color-surface-950) 80%, transparent); backdrop-filter: blur(4px); color: var(--color-ink-300)"
					aria-label="Close preview"
					title="Close"
				>×</button>
			</div>
		</div>
	</div>
{/if}
