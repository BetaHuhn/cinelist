import { fetchTrending, fetchPersonCombinedCredits, discoverMovies, discoverTV } from '$lib/api/tmdb'
import { getFavoritePeople } from '$lib/kv/people'
import type { TMDBMediaResult } from '$lib/types/tmdb'
import type { FeaturedItem } from '$lib/types/featured'
import type { FavoritePeopleByMedia } from '$lib/types/app'
import type { PageServerLoad } from './$types'

function isoDate(date: Date): string {
	return date.toISOString().split('T')[0]
}

export const load: PageServerLoad = async ({ fetch }) => {
	const trendingPromise = fetchTrending(fetch)
	const featuredPromise = (async (): Promise<FeaturedItem[]> => {
		try {
			const res = await fetch('/api/featured?limit=8')
			if (!res.ok) return []
			return (await res.json()) as FeaturedItem[]
		} catch {
			return []
		}
	})()
	const recommendedPromise = (async (): Promise<TMDBMediaResult[]> => {
		try {
			const res = await fetch('/api/recommendations?limit=24')
			if (!res.ok) return []
			return (await res.json()) as TMDBMediaResult[]
		} catch {
			return []
		}
	})()

	// Date range for "Newly Released": last 90 days up to today
	const today = new Date()
	const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
	const dateGte = isoDate(ninetyDaysAgo)
	const dateLte = isoDate(today)

	const newlyReleasedMoviesPromise = discoverMovies(
		{ 'primary_release_date.gte': dateGte, 'primary_release_date.lte': dateLte, sort_by: 'popularity.desc', 'vote_count.gte': 10 },
		fetch
	).catch(() => [])

	const newlyReleasedTVPromise = discoverTV(
		{ 'first_air_date.gte': dateGte, 'first_air_date.lte': dateLte, sort_by: 'popularity.desc', 'vote_count.gte': 10 },
		fetch
	).catch(() => [])

	// Fetch favorite people then their combined credits (sequential within this promise, parallel with everything else)
	const favoriteDataPromise = (async (): Promise<{
		favoritePeopleByMedia: FavoritePeopleByMedia
	}> => {
		try {
			const people = await getFavoritePeople()
			if (people.length === 0) return { favoritePeopleByMedia: {} }

			const allCredits = await Promise.all(
				people.map(p =>
					fetchPersonCombinedCredits(p.id, fetch).catch(() => ({ id: p.id, cast: [], crew: [] }))
				)
			)

			const favoritePeopleByMedia: FavoritePeopleByMedia = {}
			for (let i = 0; i < people.length; i++) {
				const person = people[i]
				const credits = allCredits[i]
				for (const credit of [...credits.cast, ...credits.crew]) {
					if (credit.media_type !== 'movie' && credit.media_type !== 'tv') continue
					const key = `${credit.media_type}:${credit.id}`
					if (!favoritePeopleByMedia[key]) favoritePeopleByMedia[key] = []
					if (!favoritePeopleByMedia[key].some(p => p.id === person.id)) {
						favoritePeopleByMedia[key].push({ id: person.id, name: person.name })
					}
				}
			}
			return { favoritePeopleByMedia }
		} catch {
			return { favoritePeopleByMedia: {} }
		}
	})()

	const [trending, featured, recommended, newlyReleasedMovies, newlyReleasedTV, { favoritePeopleByMedia }] =
		await Promise.all([
			trendingPromise,
			featuredPromise,
			recommendedPromise,
			newlyReleasedMoviesPromise,
			newlyReleasedTVPromise,
			favoriteDataPromise
		])

	// Merge movies and TV into a single list: up to MAX_NEWLY_RELEASED / 2 of each,
	// interleaved by popularity rank, then sort so that titles featuring a favorited person appear first.
	const MAX_NEWLY_RELEASED = 12
	const maxEach = Math.ceil(MAX_NEWLY_RELEASED / 2)
	const seen = new Set<string>()
	const newlyReleasedRaw: TMDBMediaResult[] = []

	function addNewlyReleased(item: TMDBMediaResult) {
		const key = `${item.media_type}:${item.id}`
		if (!seen.has(key)) { seen.add(key); newlyReleasedRaw.push(item) }
	}

	for (let i = 0; i < Math.max(newlyReleasedMovies.length, newlyReleasedTV.length); i++) {
		if (i < newlyReleasedMovies.length && newlyReleasedRaw.filter(r => r.media_type === 'movie').length < maxEach) {
			addNewlyReleased({ ...newlyReleasedMovies[i], media_type: 'movie' })
		}
		if (i < newlyReleasedTV.length && newlyReleasedRaw.filter(r => r.media_type === 'tv').length < maxEach) {
			addNewlyReleased({ ...newlyReleasedTV[i], media_type: 'tv' })
		}
	}

	// Stable-sort: items with a favorited person rise to the top.
	// Partition into two groups to avoid constructing key strings per comparison.
	const withFav = newlyReleasedRaw.filter(r => (favoritePeopleByMedia[`${r.media_type}:${r.id}`]?.length ?? 0) > 0)
	const withoutFav = newlyReleasedRaw.filter(r => (favoritePeopleByMedia[`${r.media_type}:${r.id}`]?.length ?? 0) === 0)
	const newlyReleased = [...withFav, ...withoutFav]

	return { trending, featured, recommended, favoritePeopleByMedia, newlyReleased }
}
