<script lang="ts">
	import { toggleMediaServer } from '$lib/stores/watchlist'
	import { addToast } from '$lib/stores/ui'
	import type { MediaType } from '$lib/types/app'

	interface Props {
		id: number
		mediaType: MediaType
		onMediaServer: boolean
	}
	let { id, mediaType, onMediaServer }: Props = $props()
	let loading = $state(false)

	async function toggle(e: MouseEvent) {
		e.preventDefault()
		e.stopPropagation()
		if (loading) return
		loading = true
		try {
			await toggleMediaServer(id, mediaType)
			addToast(onMediaServer ? 'Marked as not on server' : 'Marked as on media server', 'success')
		} catch {
			addToast('Failed to update', 'error')
		} finally {
			loading = false
		}
	}
</script>

<button
	onclick={toggle}
	disabled={loading}
	aria-label="Toggle media server status"
	class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all duration-150 ease-spring active:scale-95"
	style={onMediaServer
		? 'background: rgba(74,222,128,0.15); color: #4ade80'
		: 'background: color-mix(in srgb, var(--color-surface-600) 60%, transparent); color: var(--color-ink-500)'}
>
	<span class="size-1.5 rounded-full" style="background: {onMediaServer ? '#4ade80' : 'var(--color-ink-500)'}"></span>
	{onMediaServer ? 'On Server' : 'Not on Server'}
</button>
