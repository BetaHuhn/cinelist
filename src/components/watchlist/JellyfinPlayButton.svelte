<script lang="ts">
	import { onMount } from 'svelte'
	import { watchlist } from '$lib/stores/watchlist'
	import { buildJellyfinPlayUrl } from '$lib/utils/jellyfin'
	import type { MediaType } from '$lib/types/app'

	interface Props {
		id: number
		mediaType: MediaType
	}

	let { id, mediaType }: Props = $props()

	let jellyfinUrl = $state('')

	onMount(async () => {
		try {
			const res = await fetch('/api/config/jellyfinUrl')
			if (res.ok) {
				const body = (await res.json()) as { value?: string }
				jellyfinUrl = body.value ?? ''
			}
		} catch {}
	})

	const item = $derived($watchlist.find(i => i.id === id && i.mediaType === mediaType))
	const playUrl = $derived(
		item?.onMediaServer && item?.jellyfinItemId && jellyfinUrl
			? buildJellyfinPlayUrl(jellyfinUrl, item.jellyfinItemId)
			: null
	)
</script>

{#if playUrl}
	<a
		href={playUrl}
		target="_blank"
		rel="noopener noreferrer"
		class="inline-flex items-center gap-2 font-medium px-4 py-2 rounded-xl transition-all duration-150 ease-spring active:scale-95 hover:bg-surface-700!"
		style="background: color-mix(in srgb, var(--color-surface-700) 60%, transparent); border: 1px solid color-mix(in srgb, var(--color-surface-600) 50%, transparent); color: var(--color-ink-100)"
	>
		<span class="size-6 rounded-full flex items-center justify-center shrink-0" style="background: #000B25;">
			<img src="/icons/jellyfin.svg" alt="" class="size-4" />
		</span>
		<span>Play</span>
	</a>
{/if}
