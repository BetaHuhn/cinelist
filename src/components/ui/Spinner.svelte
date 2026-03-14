<script lang="ts">
	interface Props {
		size?: 'sm' | 'md' | 'lg'
		class?: string
	}
	let { size = 'md', class: className = '' }: Props = $props()
	const sizes = { sm: 'size-4', md: 'size-6', lg: 'size-10' }
</script>

<span
	class="inline-block border-2 border-ink-500 border-t-amber-500 rounded-full animate-spin {sizes[size]} {className}"
	role="status"
	aria-label="Loading"
></span>
