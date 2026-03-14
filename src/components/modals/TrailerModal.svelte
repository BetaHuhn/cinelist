<script lang="ts">
	import { fade, scale } from 'svelte/transition'
	import type { TMDBVideo } from '$lib/types/tmdb'

	interface Props {
		trailer: TMDBVideo
		onclose: () => void
	}
	let { trailer, onclose }: Props = $props()

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose()
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center p-4"
	style="background: color-mix(in srgb, var(--color-surface-950) 90%, transparent); backdrop-filter: blur(12px)"
	in:fade={{ duration: 200 }}
	out:fade={{ duration: 150 }}
	onclick={onclose}
>
	<div
		role="dialog"
		aria-modal="true"
		aria-label="Trailer: {trailer.name}"
		tabindex="-1"
		class="relative w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl"
		style="background: var(--color-surface-900)"
		in:scale={{ duration: 250, start: 0.95 }}
		onclick={(e) => e.stopPropagation()}
	>
		<div class="aspect-video">
			<iframe
				src="https://www.youtube-nocookie.com/embed/{trailer.key}?autoplay=1&rel=0"
				title={trailer.name}
				class="w-full h-full"
				allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
				allowfullscreen
				sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
			></iframe>
		</div>
		<button
			onclick={onclose}
			class="absolute top-3 right-3 size-8 flex items-center justify-center rounded-full transition-colors"
			style="background: color-mix(in srgb, var(--color-surface-950) 80%, transparent); backdrop-filter: blur(4px); color: var(--color-ink-300)"
			aria-label="Close trailer"
		>×</button>
	</div>
</div>
