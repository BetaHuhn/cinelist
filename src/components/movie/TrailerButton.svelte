<script lang="ts">
	import type { TMDBVideo } from '$lib/types/tmdb'

	interface Props {
		trailer: TMDBVideo
		onclick?: () => void
	}
	let { trailer, onclick }: Props = $props()
</script>

<button
	{onclick}
	class="inline-flex items-center gap-2 font-medium px-3 py-2 rounded-xl transition-all duration-150 ease-spring active:scale-95 hover:bg-surface-700!"
	style="background: color-mix(in srgb, var(--color-surface-700) 60%, transparent); border: 1px solid color-mix(in srgb, var(--color-surface-600) 50%, transparent); color: var(--color-ink-100)"
>
	<span class="size-6 rounded-full flex items-center justify-center shrink-0" style="background: var(--color-amber-500)">
		<svg class="size-4" style="fill: var(--color-surface-950)" viewBox="0 0 24 24">
			<path d="M8 5v14l11-7z" />
		</svg>
	</span>
	<span>Trailer</span>
</button>
