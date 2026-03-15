<script lang="ts">
	import { page } from '$app/state'
	import { fade } from 'svelte/transition'

	interface Props {
		children?: import('svelte').Snippet
	}
	let { children }: Props = $props()

	const pathname = $derived(page.url.pathname)
</script>

{#key pathname}
	<div in:fade={{ duration: 120 }}>
		{@render children?.()}
	</div>
{/key}
