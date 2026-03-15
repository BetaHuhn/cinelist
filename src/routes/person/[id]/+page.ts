import { error } from '@sveltejs/kit'
import type { PageLoad } from './$types'
import {
	fetchPersonCombinedCredits,
	fetchPersonDetail
} from '$lib/api/tmdb'
import type { TMDBMedia, TMDBPersonCombinedCredit } from '$lib/types/tmdb'

type SortMode = 'date' | 'importance'

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

function importanceKey(media: TMDBMedia): number {
	const popularity = typeof (media as any).popularity === 'number' ? (media as any).popularity : 0
	const voteCount = typeof (media as any).vote_count === 'number' ? (media as any).vote_count : 0
	const voteAverage = typeof (media as any).vote_average === 'number' ? (media as any).vote_average : 0
	// Heuristic: prioritize widely-seen titles first, then popularity, then rating, then recency.
	return voteCount * 0.02 + popularity * 1 + voteAverage * 0.5 + dateKey(media) / 1e12
}

function normalizeCredits(list: TMDBPersonCombinedCredit[], sort: SortMode = 'date'): TMDBMedia[] {
	const map = new Map<string, TMDBMedia>()
	for (const credit of list ?? []) {
		const media = toMedia(credit)
		if (!media) continue
		const mt = 'title' in media ? 'movie' : 'tv'
		const k = `${mt}:${media.id}`
		const prev = map.get(k)
		if (!prev || dateKey(media) > dateKey(prev)) map.set(k, media)
	}
	const values = Array.from(map.values())
	return sort === 'importance'
		? values.sort((a, b) => importanceKey(b) - importanceKey(a))
		: values.sort((a, b) => dateKey(b) - dateKey(a))
}

function jobSetForDepartment(
	department: string | null | undefined
): { label: string; jobs: string[]; kind: 'acting' | 'crew' } {
	switch ((department ?? '').toLowerCase()) {
		case 'acting':
			return { label: 'Acting Credits', jobs: [], kind: 'acting' }
		case 'directing':
			return { label: 'Directing Credits', jobs: ['Director', 'Co-Director'], kind: 'crew' }
		case 'writing':
			return {
				label: 'Writing Credits',
				jobs: ['Writer', 'Screenplay', 'Story', 'Teleplay', 'Novel', 'Characters'],
				kind: 'crew'
			}
		case 'production':
			return {
				label: 'Producing Credits',
				jobs: ['Producer', 'Executive Producer', 'Co-Producer', 'Associate Producer', 'Line Producer'],
				kind: 'crew'
			}
		case 'camera':
			return {
				label: 'Cinematography Credits',
				jobs: ['Director of Photography', 'Cinematography'],
				kind: 'crew'
			}
		case 'editing':
			return { label: 'Editing Credits', jobs: ['Editor', 'Co-Editor', 'Additional Editing'], kind: 'crew' }
		case 'sound':
			return {
				label: 'Sound / Music Credits',
				jobs: [
					'Original Music Composer',
					'Composer',
					'Supervising Sound Editor',
					'Sound Designer',
					'Sound Editor',
					'Sound Re-Recording Mixer'
				],
				kind: 'crew'
			}
		case 'art':
			return {
				label: 'Art / Design Credits',
				jobs: ['Production Design', 'Art Direction', 'Set Decoration', 'Costume Design'],
				kind: 'crew'
			}
		default:
			return { label: 'Credits', jobs: [], kind: 'crew' }
	}
}

function mediaKey(media: TMDBMedia): string {
	const mt = 'title' in media ? 'movie' : 'tv'
	return `${mt}:${media.id}`
}

function filterOut(list: TMDBMedia[], exclude: Set<string>): TMDBMedia[] {
	return list.filter((m) => !exclude.has(mediaKey(m)))
}

export const load: PageLoad = async ({ params, fetch }) => {
	const id = parseInt(params.id, 10)
	if (isNaN(id)) error(400, 'Invalid person ID')

	try {
		const [person, credits] = await Promise.all([
			fetchPersonDetail(id, fetch),
			fetchPersonCombinedCredits(id, fetch)
		])

		const actingAll = normalizeCredits(credits.cast ?? [], 'importance')
		const crewAll = normalizeCredits(credits.crew ?? [], 'importance')
		const primarySpec = jobSetForDepartment(person.known_for_department)

		let primary: TMDBMedia[] = []
		let acting: TMDBMedia[] = []
		let crew: TMDBMedia[] = []

		if (primarySpec.kind === 'acting') {
			primary = actingAll
			acting = []
			crew = crewAll
		} else if (primarySpec.jobs.length > 0) {
			const jobsLower = new Set(primarySpec.jobs.map((j) => j.toLowerCase()))
			const primaryCrewCredits = (credits.crew ?? []).filter(
				(c) => typeof c.job === 'string' && jobsLower.has(c.job.toLowerCase())
			)
			primary = normalizeCredits(primaryCrewCredits, 'importance')

			const primaryKeys = new Set(primary.map(mediaKey))
			acting = filterOut(actingAll, primaryKeys)
			crew = filterOut(crewAll, primaryKeys)
		} else {
			// Fallback: show crew as primary, acting as secondary.
			primary = crewAll
			const primaryKeys = new Set(primary.map(mediaKey))
			acting = filterOut(actingAll, primaryKeys)
			crew = []
		}

		return {
			person,
			primaryLabel: primarySpec.label,
			primary,
			acting,
			crew
		}
	} catch {
		error(404, 'Person not found')
	}
}
