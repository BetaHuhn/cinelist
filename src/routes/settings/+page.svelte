<script lang="ts">
	import { onMount } from 'svelte'
	import { untrack } from 'svelte'
	import { fade } from 'svelte/transition'
	import { addToast } from '$lib/stores/ui'
	import Button from '$components/ui/Button.svelte'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	// Use untrack so Svelte knows we intentionally want the initial value only
	// (these are mutable form fields, not derived reactive values).
	let jellyfinUrl = $state(untrack(() => data.jellyfinUrl ?? ''))
	let jellyfinApiKey = $state('')
	let jellyfinUserId = $state(untrack(() => data.jellyfinUserId ?? ''))

	let saving = $state(false)
	let testing = $state(false)
	let hasApiKey = $state(false)

	// Detect whether an API key is already saved (without exposing the value).
	async function checkApiKeyExists() {
		try {
			const res = await fetch('/api/config/jellyfinApiKey')
			if (!res.ok) return
			const body = (await res.json()) as { value?: string }
			hasApiKey = typeof body.value === 'string' && body.value.length > 0
		} catch {}
	}

	onMount(() => {
		void checkApiKeyExists()
	})

	async function saveConfig() {
		if (saving) return
		saving = true
		try {
			const updates: Array<{ key: string; value: string }> = [
				{ key: 'jellyfinUrl', value: jellyfinUrl.trim() },
				{ key: 'jellyfinUserId', value: jellyfinUserId.trim() }
			]
			// Only send the API key if the user typed something in the field.
			if (jellyfinApiKey.trim()) {
				updates.push({ key: 'jellyfinApiKey', value: jellyfinApiKey.trim() })
			}

			await Promise.all(
				updates.map(({ key, value }) =>
					fetch(`/api/config/${key}`, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ value })
					})
				)
			)
			if (jellyfinApiKey.trim()) {
				hasApiKey = true
				jellyfinApiKey = ''
			}
			addToast('Settings saved', 'success')
		} catch {
			addToast('Failed to save settings', 'error')
		} finally {
			saving = false
		}
	}

	async function testConnection() {
		if (testing) return
		if (!jellyfinUrl.trim()) {
			addToast('Enter a Jellyfin server URL first', 'error')
			return
		}
		if (!hasApiKey && !jellyfinApiKey.trim()) {
			addToast('Enter an API key first', 'error')
			return
		}
		if (!jellyfinUserId.trim()) {
			addToast('Enter a User ID first', 'error')
			return
		}
		testing = true

		// Save current values first so the sync endpoint can use them.
		await saveConfig()

		try {
			const res = await fetch('/api/jellyfin/sync', { method: 'POST' })
			if (res.ok) {
				const body = (await res.json()) as { synced: number; onServer: number }
				addToast(
					`Connected! Found ${body.onServer} item${body.onServer === 1 ? '' : 's'} on your Jellyfin server.`,
					'success',
					5000
				)
			} else {
				const body = (await res.json().catch(() => ({}))) as { message?: string }
				addToast(body.message ?? 'Connection failed', 'error', 5000)
			}
		} catch {
			addToast('Could not reach server — check the URL and try again', 'error', 5000)
		} finally {
			testing = false
		}
	}
</script>

<svelte:head>
	<title>Settings — CineList</title>
</svelte:head>

<div class="max-w-2xl mx-auto px-4 py-8" in:fade={{ duration: 200 }}>
	<h1 class="text-2xl font-bold mb-8" style="color: var(--color-ink-50)">Settings</h1>

	<!-- Jellyfin Integration -->
	<section class="rounded-2xl p-6 mb-6" style="background: var(--color-surface-800)">
		<div class="flex items-start gap-4 mb-6">
			<!-- Jellyfin logo mark -->
			<div
				class="size-10 rounded-xl flex items-center justify-center shrink-0"
				style="background: rgba(0,164,220,0.15)"
			>
				<svg viewBox="0 0 24 24" class="size-6" fill="#00a4dc" xmlns="http://www.w3.org/2000/svg">
					<path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4.5l6.75 11.25H5.25L12 4.5z" />
				</svg>
			</div>
			<div>
				<h2 class="text-lg font-semibold" style="color: var(--color-ink-50)">Jellyfin</h2>
				<p class="text-sm mt-0.5" style="color: var(--color-ink-500)">
					Connect to your Jellyfin media server to automatically sync availability and watched
					status, and to get a play button for items in your library.
				</p>
			</div>
		</div>

		<div class="flex flex-col gap-5">
			<!-- Server URL -->
			<div>
				<label for="jellyfin-url" class="block text-sm font-medium mb-1.5" style="color: var(--color-ink-200)">
					Server URL
				</label>
				<input
					id="jellyfin-url"
					type="url"
					bind:value={jellyfinUrl}
					placeholder="http://192.168.1.100:8096"
					class="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
					style="background: var(--color-surface-700); color: var(--color-ink-100); border: 1px solid var(--color-surface-600); ring-color: var(--color-amber-500)"
				/>
				<p class="mt-1 text-xs" style="color: var(--color-ink-500)">
					The base URL of your Jellyfin server, e.g. <code style="color: var(--color-ink-400)">http://localhost:8096</code>.
				</p>
			</div>

			<!-- API Key -->
			<div>
				<label for="jellyfin-api-key" class="block text-sm font-medium mb-1.5" style="color: var(--color-ink-200)">
					API Key
					{#if hasApiKey}
						<span class="ml-2 text-xs font-normal px-1.5 py-0.5 rounded-full" style="background: rgba(74,222,128,0.15); color: #4ade80">Saved</span>
					{/if}
				</label>
				<input
					id="jellyfin-api-key"
					type="password"
					bind:value={jellyfinApiKey}
					placeholder={hasApiKey ? '••••••••••••••••' : 'Paste your API key'}
					class="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
					style="background: var(--color-surface-700); color: var(--color-ink-100); border: 1px solid var(--color-surface-600)"
					autocomplete="new-password"
				/>
				<p class="mt-1 text-xs" style="color: var(--color-ink-500)">
					Generate one in Jellyfin under <strong style="color: var(--color-ink-400)">Dashboard → API Keys</strong>.
					{#if hasApiKey}Leave blank to keep your existing key.{/if}
				</p>
			</div>

			<!-- User ID -->
			<div>
				<label for="jellyfin-user-id" class="block text-sm font-medium mb-1.5" style="color: var(--color-ink-200)">
					User ID
				</label>
				<input
					id="jellyfin-user-id"
					type="text"
					bind:value={jellyfinUserId}
					placeholder="e.g. a1b2c3d4e5f6..."
					class="w-full rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-2"
					style="background: var(--color-surface-700); color: var(--color-ink-100); border: 1px solid var(--color-surface-600)"
					autocomplete="off"
				/>
				<p class="mt-1 text-xs" style="color: var(--color-ink-500)">
					Find it in Jellyfin under <strong style="color: var(--color-ink-400)">Dashboard → Users → (your user) → Profile</strong>. The ID is in the page URL.
				</p>
			</div>

			<div class="flex items-center gap-3 pt-1">
				<Button variant="primary" onclick={saveConfig} loading={saving}>
					Save
				</Button>
				<Button variant="ghost" onclick={testConnection} loading={testing}>
					Test &amp; Sync
				</Button>
			</div>
		</div>
	</section>
</div>
