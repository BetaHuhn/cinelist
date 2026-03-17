<script lang="ts">
	import { fly, fade } from 'svelte/transition'
	import { toasts, removeToast } from '$lib/stores/ui'
	import type { Toast } from '$lib/types/app'

	let hovered = $state(false)

	const icons: Record<Toast['type'], string> = {
		success: '✓',
		error: '✕',
		info: 'ℹ'
	}

	const colors: Record<Toast['type'], string> = {
		success: '#4ade80',
		error: '#f87171',
		info: 'var(--color-amber-500)'
	}

	// Toasts newest-first for display (top = most recent)
	const reversed = $derived([...$toasts].reverse())
</script>

{#if $toasts.length > 0}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
		onmouseenter={() => (hovered = true)}
		onmouseleave={() => (hovered = false)}
	>
		<div
			class="relative transition-all duration-300 ease-spring"
			style="height: {hovered ? reversed.length * 56 + 8 : Math.min(reversed.length, 3) * 8 + 48}px"
		>
			{#each reversed as toast, i (toast.id)}
				{@const isTop = i === 0}
				{@const offsetIndex = Math.min(i, 2)}
				<!-- Collapsed: stack with scale+offset. Expanded: list with gap. -->
				<div
					in:fly={{ y: 24, duration: 250 }}
					out:fade={{ duration: 150 }}
					class="absolute left-0 right-0 pointer-events-auto glass rounded-xl px-4 py-3 flex items-center gap-3 shadow-xl text-sm font-medium transition-all duration-300 ease-spring cursor-default select-none"
					style="
						color: {colors[toast.type]};
						bottom: {hovered ? i * 56 : offsetIndex * 8}px;
						transform: scale({hovered ? 1 : 1 - offsetIndex * 0.04});
						transform-origin: bottom center;
						opacity: {hovered ? 1 : i > 2 ? 0 : 1 - offsetIndex * 0.15};
						z-index: {reversed.length - i};
					"
				>
					<span aria-hidden="true" style="color: {colors[toast.type]}; flex-shrink: 0">{icons[toast.type]}</span>
					<span class="flex-1 truncate" style="color: var(--color-ink-100)">{toast.message}</span>
					{#if hovered || isTop}
						<button
							onclick={() => removeToast(toast.id)}
							class="opacity-50 hover:opacity-100 transition-opacity flex-shrink-0 text-base leading-none"
							aria-label="Dismiss notification"
							style="color: var(--color-ink-300)"
						>×</button>
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}

<!-- Visually hidden live region: announces toast messages to screen readers -->
<div aria-live="polite" aria-atomic="true" class="sr-only">
	{#if $toasts.length > 0}
		{$toasts[$toasts.length - 1].message}
	{/if}
</div>
