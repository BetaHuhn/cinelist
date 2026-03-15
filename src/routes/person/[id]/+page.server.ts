import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import {
	fetchPersonCombinedCredits,
	fetchPersonDetail
} from '$lib/api/tmdb'
import type { TMDBMedia, TMDBPersonCombinedCredit } from '$lib/types/tmdb'

function toMedia(credit: TMDBPersonCombinedCredit): TMDBMedia | null {
	if (!credit || typeof credit.id !== 'number') return null
	const mediaType = credit.media_type
	if (mediaType !== 'movie' && mediaType !== 'tv') return null
	
	const base = {
		id: credit.id,
		overview: (credit as any).overview ?? '',
		poster_path: (credit as any).poster_path ?? null,
		backdrop_path: (credit as any).backdrop_path ?? null,
		vote_average: typeof (credit as any).vote_average === 'number' ? (credit as any).vote_average : 0,
		vote_count: typeof (credit as any).vote_count === 'number' ? (credit as any).vote_count : 0,
		genre_ids: Array.isArray((credit as any).genre_ids) ? (credit as any).genre_ids : [],
		popularity: typeof (credit as any).popularity === 'number' ? (credit as any).popularity : 0,
		original_language: typeof (credit as any).original_language === 'string' ? (credit as any).original_language : 'en'
	}

	return mediaType === 'movie'
		? {
			...base,
			title: typeof (credit as any).title === 'string' ? (credit as any).title : '',
			release_date: typeof (credit as any).release_date === 'string' ? (credit as any).release_date : ''
		}
		: {
			...base,
			name: typeof (credit as any).name === 'string' ? (credit as any).name : '',
			first_air_date: typeof (credit as any).first_air_date === 'string' ? (credit as any).first_air_date : ''
		}
}

function dateKey(media: TMDBMedia): number {
	const date = 'release_date' in media ? media.release_date : media.first_air_date
	const t = Date.parse(date)
	return Number.isFinite(t) ? t : 0
}

function normalizeCredits(list: TMDBPersonCombinedCredit[]): TMDBMedia[] {
	const map = new Map<string, TMDBMedia>()
	for (const credit of list ?? []) {
		const media = toMedia(credit)
		if (!media) continue
		const mt = 'title' in media ? 'movie' : 'tv'
		const k = `${mt}:${media.id}`
		const prev = map.get(k)
		if (!prev || dateKey(media) > dateKey(prev)) map.set(k, media)
	}
	return Array.from(map.values()).sort((a, b) => dateKey(b) - dateKey(a))
}

export const load: PageServerLoad = async ({ params, fetch }) => {
	const id = parseInt(params.id, 10)
	if (isNaN(id)) error(400, 'Invalid person ID')

	try {
		const [person, credits] = await Promise.all([
			fetchPersonDetail(id, fetch),
			fetchPersonCombinedCredits(id, fetch)
		])

		return {
			person,
			acting: normalizeCredits(credits.cast ?? []),
			crew: normalizeCredits(credits.crew ?? [])
		}
	} catch {
		error(404, 'Person not found')
	}
}
