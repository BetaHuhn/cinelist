<script lang="ts">
	import { profileUrl } from '$lib/utils/image'
	import { openPersonContextMenu } from '$lib/stores/personContextMenu'

	type PersonLike = {
		id: number
		name: string
		profile_path?: string | null
		character?: string | null
		job?: string | null
		known_for_department?: string | null
	}

	interface Props {
		title: string
		people: PersonLike[]
		subtitleKey: 'character' | 'job'
		initialLimit?: number
	}

	let { title, people, subtitleKey, initialLimit = 12 }: Props = $props()
	let viewAll = $state(false)

	const visiblePeople = $derived(people.slice(0, viewAll ? undefined : initialLimit))
	const showToggle = $derived(people.length > initialLimit)

	function toggleViewAll() {
		viewAll = !viewAll
	}

	function getSubtitle(person: PersonLike): string {
		const value = person[subtitleKey]
		return typeof value === 'string' ? value : ''
	}
</script>

{#if people.length > 0}
	<div class="mt-10">
		<h2 class="text-lg font-semibold mb-4" style="color: var(--color-ink-100)">{title}</h2>
		<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
			{#each visiblePeople as member, i (member.id + '-' + i)}
				<a
					href={`/person/${member.id}`}
					class="flex flex-col items-center text-center gap-2"
					style="color: inherit"
					oncontextmenu={(e) => {
						e.preventDefault()
						openPersonContextMenu({
							x: e.clientX,
							y: e.clientY,
							id: member.id,
							name: member.name,
							profile_path: member.profile_path ?? null,
							known_for_department: member.known_for_department ?? null,
							href: `/person/${member.id}`
						})
					}}
				>
					<div class="size-16 sm:size-20 rounded-full overflow-hidden shrink-0" style="background: var(--color-surface-700)">
						<img src={profileUrl(member.profile_path)} alt={member.name} class="w-full h-full object-cover" loading="lazy" />
					</div>
					<div>
						<p class="text-xs font-semibold leading-tight" style="color: var(--color-ink-100)">{member.name}</p>
						<p class="text-[11px] leading-tight mt-0.5 line-clamp-2" style="color: var(--color-ink-500)">{getSubtitle(member)}</p>
					</div>
				</a>
			{/each}
		</div>

		{#if showToggle}
			<div class="mt-4 flex justify-center">
				<button onclick={toggleViewAll} class="text-sm font-medium underline-offset-2 hover:underline" style="color: var(--color-ink-300)">
					{viewAll ? 'View Less' : 'View All'}
				</button>
			</div>
		{/if}
	</div>
{/if}
