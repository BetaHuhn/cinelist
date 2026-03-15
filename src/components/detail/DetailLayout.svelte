<script lang="ts">
	import { backdropUrl, posterUrl } from '$lib/utils/image'
	import type { Snippet } from 'svelte'

	interface Props {
		title: string
		tagline?: string | null
		posterPath: string | null | undefined
		backdropPath?: string | null | undefined
		posterAlt?: string
		header?: Snippet
		children?: Snippet
	}

	let { title, tagline = null, posterPath, backdropPath = null, posterAlt, header, children }: Props = $props()
</script>

<!-- Backdrop Hero -->
<div class="relative h-[40vh] sm:h-[40vh] overflow-hidden" style="background: var(--color-surface-800)">
	{#if backdropPath}
		<img src={backdropUrl(backdropPath)} alt="" class="w-full h-full object-cover object-top opacity-60" />
	{/if}
	<div
		class="absolute inset-0"
		style="background: linear-gradient(to top, var(--color-surface-950) 0%, color-mix(in srgb, var(--color-surface-950) 40%, transparent) 50%, transparent 100%)"
	></div>
</div>

<!-- Content -->
<div class="max-w-5xl mx-auto px-4 -mt-32 relative z-10 pb-16">
	<div class="flex flex-col sm:flex-row gap-8">
		<!-- Poster -->
		<div class="shrink-0 mx-auto sm:mx-0">
			<img
				src={posterUrl(posterPath, 'w500')}
				alt={posterAlt ?? title}
				class="w-44 sm:w-56 rounded-2xl shadow-2xl"
				style="outline: 1px solid color-mix(in srgb, var(--color-surface-700) 50%, transparent)"
			/>
		</div>

		<!-- Info -->
		<div class="flex-1 flex flex-col gap-4 pt-2 sm:pt-8">
			<div>
				<h1 class="text-3xl sm:text-4xl font-bold leading-tight" style="color: var(--color-ink-50)">{title}</h1>
				{#if tagline}
					<p class="italic mt-1" style="color: var(--color-ink-500)">{tagline}</p>
				{/if}
			</div>

			{@render header?.()}
		</div>
	</div>

	{@render children?.()}
</div>
