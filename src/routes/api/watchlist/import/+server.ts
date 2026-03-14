import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { addItem, getWatchlist } from '$lib/kv/watchlist'
import { clearHomeRecommendationsCache } from '$lib/kv/recommendations'
import type { WatchlistItem } from '$lib/types/app'
import {
	isMovieRow,
	parseWatchlistCsv,
	resolveRowToTMDBMovie,
	type WatchlistImportResult
} from '$lib/import/watchlist'

interface ImportRequestBody {
	csv: string
	source?: 'csv' | 'werstreamtes'
	dryRun?: boolean
}

type ResolvedEntry =
	| { rowNumber: number; movie: Awaited<ReturnType<typeof resolveRowToTMDBMovie>> }
	| { rowNumber: number; error: string }

function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
	return new Promise((resolve, reject) => {
		const results: R[] = new Array(items.length)
		let nextIndex = 0
		let inFlight = 0
		let done = 0

		const launch = () => {
			while (inFlight < limit && nextIndex < items.length) {
				const current = nextIndex++
				inFlight++
				fn(items[current], current)
					.then(r => {
						results[current] = r
					})
					.catch(reject)
					.finally(() => {
						inFlight--
						done++
						if (done === items.length) resolve(results)
						else launch()
					})
			}
		}

		if (items.length === 0) resolve([])
		else launch()
	})
}

export const POST: RequestHandler = async ({ request, fetch }) => {
	let body: ImportRequestBody
	try {
		body = (await request.json()) as ImportRequestBody
	} catch {
		error(400, 'Invalid JSON')
	}

	if (typeof body.csv !== 'string') error(400, 'Missing csv')
	if (body.csv.length > 2_000_000) error(413, 'CSV too large')

	const { rows, errors: parseErrors } = parseWatchlistCsv(body.csv)
	const watchlist = await getWatchlist()
	const existingIds = new Set(watchlist.filter(i => i.mediaType === 'movie').map(i => i.id))

	const result: WatchlistImportResult = {
		totalRows: rows.length,
		parsedRows: rows.length,
		added: 0,
		skippedExisting: 0,
		skippedNonMovie: 0,
		notFound: 0,
		errors: [...parseErrors],
		addedIds: []
	}

	const movieRows = rows.filter(isMovieRow)
	result.skippedNonMovie = rows.length - movieRows.length

	const resolved = await mapLimit<Parameters<typeof isMovieRow>[0], ResolvedEntry>(movieRows, 4, async row => {
		if (!row.title && !row.originalTitle && !row.link) {
			return { rowNumber: row.rowNumber, error: 'Missing title/link' }
		}
		try {
			const movie = await resolveRowToTMDBMovie(row, fetch)
			return { rowNumber: row.rowNumber, movie }
		} catch (e) {
			return {
				rowNumber: row.rowNumber,
				error: e instanceof Error ? e.message : 'Failed to resolve'
			}
		}
	})

	for (const entry of resolved) {
		if ('error' in entry) {
			result.errors.push({ rowNumber: entry.rowNumber, message: entry.error })
			result.notFound++
			continue
		}
		const movie = entry.movie
		if (!movie) {
			result.notFound++
			continue
		}

		if (existingIds.has(movie.id)) {
			result.skippedExisting++
			continue
		}

		if (body.dryRun) {
			result.added++
			result.addedIds.push(movie.id)
			existingIds.add(movie.id)
			continue
		}

		const payload: Omit<WatchlistItem, 'addedAt' | 'onMediaServer'> = {
			mediaType: 'movie',
			id: movie.id,
			title: movie.title,
			poster_path: movie.poster_path,
			backdrop_path: movie.backdrop_path,
			release_date: movie.release_date,
			vote_average: movie.vote_average,
			genre_ids: movie.genre_ids ?? movie.genres?.map(g => g.id) ?? []
		}

		await addItem(payload)
		result.added++
		result.addedIds.push(movie.id)
		existingIds.add(movie.id)
	}

	if (!body.dryRun && result.added > 0) {
		await clearHomeRecommendationsCache()
	}

	return json(result, { status: 200 })
}
