<script lang="ts">
	import { onMount } from 'svelte'
	import { fade } from 'svelte/transition'
	import { profileUrl } from '$lib/utils/image'
	import MovieGrid from '$components/movie/MovieGrid.svelte'
	import Button from '$components/ui/Button.svelte'
	import { addToast } from '$lib/stores/ui'
	import { favoritePeople } from '$lib/stores/people'
	import { toggleFavoritePerson } from '$lib/stores/people'
	import { navHistory } from '$lib/stores/navigationHistory'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	const person = $derived(data.person)
	const primaryLabel = $derived(data.primaryLabel ?? 'Credits')
	const primaryCredits = $derived(data.primary ?? [])
	const acting = $derived(data.acting ?? [])
	const crew = $derived(data.crew ?? [])
	const crewLabel = $derived(primaryLabel === 'Acting Credits' ? 'Crew Credits' : 'Other Crew Credits')

	const isFav = $derived($favoritePeople.some(p => p.id === person.id))
	let saving = $state(false)
	let showMore = $state(false)

	onMount(() => {
		navHistory.push({
			type: 'person',
			id: person.id,
			title: person.name,
			posterPath: person.profile_path ?? null,
			href: `/person/${person.id}`
		})
	})

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
						{isFav ? '★ Favorited' : '☆ Favorite'}
					</Button>
				</div>
			</div>

			{#if person.biography}
				{#if showMore}
					<p class="text-sm mt-4 leading-relaxed" style="color: var(--color-ink-300)">
						{person.biography}
					</p>
					<button class="text-sm" style="color: var(--color-ink-400)" onclick={() => showMore = false}>Less</button>
				{:else}
					<p class="text-sm mt-4 leading-relaxed line-clamp-3" style="color: var(--color-ink-300)">
						{person.biography}
					</p>
					<button class="text-sm" style="color: var(--color-ink-400)" onclick={() => showMore = true}>More</button>
				{/if}
			{/if}
		</div>
	</div>

	{#if primaryCredits.length > 0}
		<div class="mt-10">
			<h2 class="text-lg font-semibold mb-4" style="color: var(--color-ink-100)">{primaryLabel}</h2>
			<MovieGrid movies={primaryCredits} />
		</div>
	{/if}

	{#if acting.length > 0}
		<div class="mt-10">
			<h2 class="text-lg font-semibold mb-4" style="color: var(--color-ink-100)">Acting Credits</h2>
			<MovieGrid movies={acting} />
		</div>
	{/if}

	{#if crew.length > 0}
		<div class="mt-10">
			<h2 class="text-lg font-semibold mb-4" style="color: var(--color-ink-100)">{crewLabel}</h2>
			<MovieGrid movies={crew} />
		</div>
	{/if}

	{#if primaryCredits.length === 0 && acting.length === 0 && crew.length === 0}
		<p class="text-sm mt-10" style="color: var(--color-ink-400)">No credits found.</p>
	{/if}
</section>
