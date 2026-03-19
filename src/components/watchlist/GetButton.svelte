<script lang="ts">
	import { onMount } from 'svelte'
	import { watchlist } from '$lib/stores/watchlist'
	import { buildProviderUrl } from '$lib/utils/provider'
	import type { MediaType } from '$lib/types/app'

	interface Props {
		id: number
		mediaType: MediaType
		title: string
		releaseDate: string
	}

	let { id, mediaType, title, releaseDate }: Props = $props()

	let customProviderUrl = $state('')

	onMount(async () => {
		try {
			const res = await fetch('/api/config/customProviderUrl')
			if (res.ok) {
				const body = (await res.json()) as { value?: string }
				customProviderUrl = body.value ?? ''
			}
		} catch {}
	})

	const item = $derived($watchlist.find(i => i.id === id && i.mediaType === mediaType))
	const onServer = $derived(item?.onMediaServer ?? false)

	const getUrl = $derived(
		customProviderUrl && !onServer
			? buildProviderUrl(customProviderUrl, title, releaseDate)
			: null
	)
</script>

{#if getUrl}
	<a
		href={getUrl}
		target="_blank"
		rel="noopener noreferrer"
		class="inline-flex items-center gap-2 font-medium pl-3 pr-4 py-2 rounded-xl transition-all duration-150 ease-spring active:scale-95 hover:bg-surface-700!"
		style="background: color-mix(in srgb, var(--color-surface-700) 60%, transparent); border: 1px solid color-mix(in srgb, var(--color-surface-600) 50%, transparent); color: var(--color-ink-100)"
		aria-label="Get from provider (opens in new tab)"
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
			<polyline points="15 3 21 3 21 9" />
			<line x1="10" y1="14" x2="21" y2="3" />
		</svg>
		<span>Get</span>
	</a>
{/if}
