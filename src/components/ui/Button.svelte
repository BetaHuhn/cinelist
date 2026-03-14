<script lang="ts">
	interface Props {
		variant?: 'primary' | 'ghost' | 'danger'
		size?: 'sm' | 'md' | 'lg'
		disabled?: boolean
		loading?: boolean
		class?: string
		onclick?: (e: MouseEvent) => void
		type?: 'button' | 'submit' | 'reset'
		children?: import('svelte').Snippet
	}

	let {
		variant = 'primary',
		size = 'md',
		disabled = false,
		loading = false,
		class: className = '',
		onclick,
		type = 'button',
		children
	}: Props = $props()

	const sizes = {
		sm: 'text-sm px-3 py-1.5',
		md: 'text-sm px-4 py-2',
		lg: 'text-base px-5 py-2.5'
	}
</script>

<button
	{type}
	class="inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-150 ease-spring active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 select-none {sizes[size]} {className}"
	class:btn-primary={variant === 'primary'}
	class:btn-ghost={variant === 'ghost'}
	disabled={disabled || loading}
	{onclick}
	style={variant === 'danger' ? 'background: rgba(248,113,113,0.15); color: #f87171' : undefined}
>
	{#if loading}
		<span class="size-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
	{/if}
	{@render children?.()}
</button>
