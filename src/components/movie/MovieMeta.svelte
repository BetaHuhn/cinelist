<script lang="ts">
	import Badge from '$components/ui/Badge.svelte'
	import { formatRuntime, formatDate } from '$lib/utils/format'
	import type { MovieDetail } from '$lib/types/app'

	interface Props {
		movie: MovieDetail
	}
	let { movie }: Props = $props()
</script>

<div class="flex flex-wrap items-center gap-2 text-sm" style="color: var(--color-ink-300)">
	{#if movie.certification}
		<Badge variant="default">{movie.certification}</Badge>
	{/if}
	<span>{formatDate(movie.release_date)}</span>
	{#if movie.runtime}
		<span>·</span>
		<span>{formatRuntime(movie.runtime)}</span>
	{/if}
	{#if movie.original_language && movie.original_language !== 'en'}
		<span>·</span>
		<span class="uppercase">{movie.original_language}</span>
	{/if}
</div>

{#if movie.genres && movie.genres.length > 0}
	<div class="flex flex-wrap gap-2 mt-2">
		{#each movie.genres as genre (genre.id)}
			<Badge variant="default">{genre.name}</Badge>
		{/each}
	</div>
{/if}
