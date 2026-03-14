<script lang="ts">
	interface Props {
		label: string
		value: string | number | null
		icon?: string
	}
	let { label, value, icon = '' }: Props = $props()
</script>

{#if value}
	<div class="flex flex-col items-center gap-1 rounded-xl px-4 py-3 min-w-[80px]" style="background: color-mix(in srgb, var(--color-surface-700) 50%, transparent)">
		{#if icon}
			<span class="text-lg">{icon}</span>
		{/if}
		<span class="text-lg font-bold" style="color: var(--color-ink-50)">{value}</span>
		<span class="text-xs" style="color: var(--color-ink-500)">{label}</span>
	</div>
{/if}
