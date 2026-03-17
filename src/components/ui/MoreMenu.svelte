<script lang="ts">
    import type { Snippet, SvelteComponent } from "svelte";
    import Button from "./Button.svelte";

	interface MenuItem {
        icon?: typeof SvelteComponent<any>
		label: string
        hidden?: boolean
		action: () => void
	}

	interface Props {
		items: MenuItem[]
		children?: Snippet
        className?: string
	}

	let { items, children, className }: Props = $props()

	let open = $state(false)
	let menuEl = $state<HTMLDivElement | null>(null)

	function toggle() {
		open = !open
	}

	function close() {
		open = false
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close()
	}

	function handleOutsideClick(e: MouseEvent) {
		if (menuEl && !menuEl.contains(e.target as Node)) close()
	}

    function handleClick(item: MenuItem) {
        close()
        item.action()
    }
</script>

<svelte:window onkeydown={handleKeydown} onclick={handleOutsideClick} />

<div class="relative" bind:this={menuEl}>
    <Button variant="ghost" size="sm" class="py-2 {className}" onclick={(e) => { e.stopPropagation(); toggle() }}>
        {#if children}
			{@render children()}
		{:else}
			<!-- Three vertical dots icon -->
			<svg xmlns="http://www.w3.org/2000/svg" class="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>
		{/if}
    </Button>

	{#if open}
		<div
			role="menu"
			class="absolute z-50 right-0 top-full mt-2 min-w-44 rounded-xl shadow-xl overflow-hidden"
			style="background: var(--color-surface-800); border: 1px solid var(--color-surface-700)"
		>
			{#each items as item, idx ('item-' + idx)}
                {#if !item.hidden}
                    <button
                        role="menuitem"
                        type="button"
                        onclick={() => handleClick(item)}
                        class="w-full text-left px-3 py-2 text-sm transition-colors duration-100 flex items-center gap-2"
                        style="color: var(--color-ink-300)"
                        onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-700)' }}
                        onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}
                    >
                        {#if item.icon}
                            <span class="size-4 flex items-center justify-center shrink-0" style="color: var(--color-ink-300)">
                                <svelte:component this={item.icon} />
                            </span>
                        {/if}
                        <span>{item.label}</span>
                    </button>
                {/if}
            {/each}
		</div>
	{/if}
</div>
