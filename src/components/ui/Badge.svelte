<script lang="ts">
	interface Props {
		variant?: 'default' | 'amber' | 'green' | 'blue' | 'red'
		class?: string
		children?: import('svelte').Snippet
	}

	let { variant = 'default', class: className = '', children }: Props = $props()

	const styles: Record<string, string> = {
		default: 'background: var(--color-surface-600); color: var(--color-ink-300)',
		amber: 'background: color-mix(in srgb, var(--color-amber-500) 20%, transparent); color: var(--color-amber-500)',
		green: 'background: rgba(74,222,128,0.15); color: #4ade80',
		blue: 'background: rgba(96,165,250,0.15); color: #60a5fa',
		red: 'background: rgba(248,113,113,0.15); color: #f87171'
	}
</script>

<span
	class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full {className}"
	style={styles[variant]}
>
	{@render children?.()}
</span>
