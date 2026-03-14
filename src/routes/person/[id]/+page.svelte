<script lang="ts">
	import { fade } from 'svelte/transition'
	import { profileUrl } from '$lib/utils/image'
	import MovieGrid from '$components/movie/MovieGrid.svelte'
	import Button from '$components/ui/Button.svelte'
	import { addToast } from '$lib/stores/ui'
	import { favoritePeople } from '$lib/stores/people'
	import { toggleFavoritePerson } from '$lib/stores/people'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	const person = $derived(data.person)
	const acting = $derived(data.acting ?? [])
	const crew = $derived(data.crew ?? [])

	const isFav = $derived($favoritePeople.some(p => p.id === person.id))
	let saving = $state(false)

	async function toggle() {
		const wasFav = isFav
		saving = true
		try {
			await toggleFavoritePerson({
				id: person.id,
				name: person.name,
				profile_path: person.profile_path ?? null,
				known_for_department: person.known_for_department ?? null
			})
			addToast(wasFav ? 'Removed from favorites' : 'Added to favorites', 'success')
		} catch {
			addToast('Could not update favorites', 'error')
		} finally {
			saving = false
		}
	}
</script>

<svelte:head>
	<title>{person.name} — CineList</title>
	<meta name="description" content={person.biography ? person.biography.slice(0, 140) : `Filmography for ${person.name}`} />
</svelte:head>

<section class="max-w-7xl mx-auto px-4 py-10" in:fade={{ duration: 200 }}>
	<div class="flex flex-col sm:flex-row gap-6 items-start">
		<div class="size-24 sm:size-28 rounded-2xl overflow-hidden flex-shrink-0" style="background: var(--color-surface-800)">
			<img src={profileUrl(person.profile_path, 'w185')} alt={person.name} class="w-full h-full object-cover" />
		</div>

		<div class="flex-1 min-w-0">
			<div class="flex items-start justify-between gap-4">
				<div class="min-w-0">
					<h1 class="text-2xl sm:text-3xl font-bold" style="color: var(--color-ink-50)">{person.name}</h1>
					<p class="text-sm mt-1" style="color: var(--color-ink-500)">
						{person.known_for_department ?? 'Person'}
						{#if person.place_of_birth}
							· {person.place_of_birth}
						{/if}
					</p>
				</div>
				<div class="flex-shrink-0">
						<Button variant={isFav ? 'primary' : 'ghost'} size="sm" loading={saving} onclick={toggle}>
						{isFav ? 'Favorited' : 'Favorite'}
					</Button>
				</div>
			</div>

			{#if person.biography}
				<p class="text-sm mt-4 leading-relaxed" style="color: var(--color-ink-300)">{person.biography}</p>
			{/if}
		</div>
	</div>

	{#if acting.length > 0}
		<div class="mt-10">
			<h2 class="text-lg font-semibold mb-4" style="color: var(--color-ink-100)">Acting Credits</h2>
			<MovieGrid movies={acting.slice(0, 36)} />
		</div>
	{/if}

	{#if crew.length > 0}
		<div class="mt-10">
			<h2 class="text-lg font-semibold mb-4" style="color: var(--color-ink-100)">Crew Credits</h2>
			<MovieGrid movies={crew.slice(0, 36)} />
		</div>
	{/if}

	{#if acting.length === 0 && crew.length === 0}
		<p class="text-sm mt-10" style="color: var(--color-ink-400)">No credits found.</p>
	{/if}
</section>
