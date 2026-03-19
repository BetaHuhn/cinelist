<script lang="ts">
	import { posterUrl } from '$lib/utils/image'
	import { formatYear } from '$lib/utils/format'
	import { buildJellyfinPlayUrl } from '$lib/utils/jellyfin'
	import type { WatchlistItem } from '$lib/types/app'
	import type { TMDBMedia } from '$lib/types/tmdb'
	import WatchlistButton from '$components/watchlist/WatchlistButton.svelte'
	import { openContextMenu } from '$lib/stores/contextMenu'

	interface Props {
		item: WatchlistItem
		jellyfinUrl: string
		handleClick: (e: MouseEvent, mediaType: 'movie' | 'tv', id: number) => void
		startHold: (e: PointerEvent, mediaType: 'movie' | 'tv', id: number) => void
		moveHold: (e: PointerEvent) => void
		endHold: () => void
		suppressClick: boolean
	}

	let { item, jellyfinUrl, handleClick, startHold, moveHold, endHold, suppressClick }: Props = $props()

	const href = $derived(item.mediaType === 'tv' ? `/tv/${item.id}` : `/movie/${item.id}`)
	const media = $derived.by((): TMDBMedia => {
		const base = {
			id: item.id,
			overview: '',
			poster_path: item.poster_path,
			backdrop_path: item.backdrop_path,
			vote_average: item.vote_average,
			vote_count: 0,
			genre_ids: item.genre_ids,
			popularity: 0,
			original_language: 'en' as const
		}
		return item.mediaType === 'tv'
			? { ...base, name: item.title, first_air_date: item.release_date }
			: { ...base, title: item.title, release_date: item.release_date }
	})

	const jellyfinPlayUrl = $derived(
		jellyfinUrl && item.jellyfinItemId
			? buildJellyfinPlayUrl(jellyfinUrl, item.jellyfinItemId)
			: null
	)
</script>

<a
	href={href}
	onclick={(e) => handleClick(e, item.mediaType, item.id)}
	onpointerdown={(e) => startHold(e, item.mediaType, item.id)}
	onpointermove={moveHold}
	onpointerup={endHold}
	onpointercancel={endHold}
	oncontextmenu={(e) => {
		e.preventDefault()
		openContextMenu({
			x: e.clientX,
			y: e.clientY,
			mediaType: item.mediaType,
			id: item.id,
			title: item.title,
			poster_path: item.poster_path,
			backdrop_path: item.backdrop_path,
			release_date: item.release_date,
			vote_average: item.vote_average,
			genre_ids: item.genre_ids,
			href
		})
	}}
	class="group flex gap-4 rounded-xl overflow-hidden transition-colors card-hover"
	style="background: var(--color-surface-800); color: inherit"
>
	<!-- Poster -->
	<div class="w-20 shrink-0" style="background: var(--color-surface-700)">
		<img
			src={posterUrl(item.poster_path, 'w185')}
			alt={item.title}
			class="w-full h-full object-cover"
			loading="lazy"
		/>
	</div>

	<!-- Info -->
	<div class="flex-1 py-3 pr-3 flex flex-col gap-2 min-w-0">
		<div>
			<p class="text-sm font-semibold leading-snug line-clamp-2" style="color: var(--color-ink-100)">{item.title}</p>
			<p class="text-xs mt-0.5" style="color: var(--color-ink-500)">{formatYear(item.release_date)}</p>
		</div>

		<div class="mt-auto flex items-center justify-between">
			{#if item.userRating !== null && item.userRating !== undefined}
				<span class="text-xs font-semibold" style="color: var(--color-amber-300)" title="Your rating">★ {item.userRating}/10</span>
			{:else if item.vote_average > 0}
				<span class="text-xs font-semibold" style="color: var(--color-amber-500)">★ {item.vote_average.toFixed(1)}</span>
			{:else}
				<span></span>
			{/if}

			<div class="flex items-center gap-2 flex-wrap">
				{#if jellyfinPlayUrl}
					<button
						type="button"
						data-no-preview
						aria-label="Play in Jellyfin"
						onclick={(e) => {
							e.preventDefault()
							e.stopPropagation()
							window.open(jellyfinPlayUrl, '_blank', 'noopener,noreferrer')
						}}
						class="inline-flex items-center gap-1.5 text-xs font-medium px-1 py-1 rounded-full transition-all duration-150 ease-spring active:scale-95"
						style="background: #000B25;"
					>
						<img src="/icons/jellyfin.svg" alt="" class="size-4" />
					</button>
				{/if}
				<WatchlistButton media={media} size="sm" hideDropdown hideTooltip hideLabel minimal />
			</div>
		</div>
	</div>
</a>
