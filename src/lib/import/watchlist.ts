import type { TMDBMovie } from '$lib/types/tmdb'
import { fetchMovieDetail, searchMovies } from '$lib/api/tmdb'

export type ImportSource = 'csv' | 'werstreamtes'

export interface WatchlistImportRow {
	rowNumber: number
	type: string | null
	wseId: string | null
	title: string | null
	originalTitle: string | null
	year: number | null
	link: string | null
}

export interface WatchlistImportResult {
	totalRows: number
	parsedRows: number
	added: number
	skippedExisting: number
	skippedNonMovie: number
	notFound: number
	errors: { rowNumber: number; message: string }[]
	addedIds: number[]
}

function normalizeCell(value: string | undefined): string {
	return (value ?? '').trim().replace(/^\uFEFF/, '')
}

function parseMaybeYear(value: string | null): number | null {
	if (!value) return null
	const match = value.match(/\b(19\d{2}|20\d{2})\b/)
	if (!match) return null
	const year = parseInt(match[1], 10)
	return Number.isFinite(year) ? year : null
}

function detectDelimiter(headerLine: string): ',' | ';' | '\t' {
	const comma = (headerLine.match(/,/g) ?? []).length
	const semicolon = (headerLine.match(/;/g) ?? []).length
	const tab = (headerLine.match(/\t/g) ?? []).length
	if (semicolon > comma && semicolon >= tab) return ';'
	if (tab > comma && tab > semicolon) return '\t'
	return ','
}

function parseCsvLine(line: string, delimiter: string): string[] {
	const out: string[] = []
	let current = ''
	let inQuotes = false

	for (let i = 0; i < line.length; i++) {
		const char = line[i]
		if (char === '"') {
			const next = line[i + 1]
			if (inQuotes && next === '"') {
				current += '"'
				i++
				continue
			}
			inQuotes = !inQuotes
			continue
		}

		if (!inQuotes && char === delimiter) {
			out.push(current)
			current = ''
			continue
		}

		current += char
	}

	out.push(current)
	return out
}

function parseCsv(text: string): { delimiter: string; rows: string[][] } {
	const normalized = text.replace(/\r\n?/g, '\n')
	const lines = normalized.split('\n').filter(l => l.trim().length > 0)
	if (lines.length === 0) return { delimiter: ',', rows: [] }
	const delimiter = detectDelimiter(lines[0])
	const rows = lines.map(l => parseCsvLine(l, delimiter))
	return { delimiter, rows }
}

function isHeaderRow(cells: string[]): boolean {
	const joined = cells.map(c => normalizeCell(c).toLowerCase()).join('|')
	return joined.includes('type') && (joined.includes('title') || joined.includes('originaltitle'))
}

function headerIndexMap(header: string[]): Record<string, number> {
	const map: Record<string, number> = {}
	header.forEach((cell, idx) => {
		const key = normalizeCell(cell)
			.toLowerCase()
			.replace(/\s+/g, '')
			.replace(/[^a-z0-9-]/g, '')
		if (key) map[key] = idx
	})
	return map
}

function getByHeader(cells: string[], map: Record<string, number>, ...keys: string[]): string | null {
	for (const key of keys) {
		const idx = map[key]
		if (idx === undefined) continue
		const value = normalizeCell(cells[idx])
		if (value) return value
	}
	return null
}

export function parseWatchlistCsv(text: string): { rows: WatchlistImportRow[]; errors: WatchlistImportResult['errors'] } {
	const { rows: rawRows } = parseCsv(text)
	const errors: WatchlistImportResult['errors'] = []
	if (rawRows.length === 0) return { rows: [], errors }

	let header: string[] | null = null
	let startIndex = 0
	if (isHeaderRow(rawRows[0])) {
		header = rawRows[0]
		startIndex = 1
	}

	const headerMap = header ? headerIndexMap(header) : null

	const rows: WatchlistImportRow[] = []
	for (let i = startIndex; i < rawRows.length; i++) {
		const cells = rawRows[i]
		try {
			const rowNumber = i + 1
			const type = headerMap
				? getByHeader(cells, headerMap, 'type')
				: normalizeCell(cells[0]) || null
			const wseId = headerMap
				? getByHeader(cells, headerMap, 'wse-id', 'wseid', 'wse')
				: normalizeCell(cells[1]) || null
			const title = headerMap
				? getByHeader(cells, headerMap, 'title')
				: normalizeCell(cells[2]) || null
			const originalTitle = headerMap
				? getByHeader(cells, headerMap, 'originaltitle', 'original')
				: normalizeCell(cells[3]) || null
			const yearRaw = headerMap
				? getByHeader(cells, headerMap, 'year')
				: normalizeCell(cells[4]) || null
			const link = headerMap
				? getByHeader(cells, headerMap, 'link', 'url')
				: normalizeCell(cells[5]) || null

			rows.push({
				rowNumber,
				type,
				wseId,
				title,
				originalTitle,
				year: parseMaybeYear(yearRaw),
				link
			})
		} catch (e) {
			errors.push({ rowNumber: i + 1, message: e instanceof Error ? e.message : 'Failed to parse row' })
		}
	}

	return { rows, errors }
}

function normalizeTitle(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
}

function extractTmdbIdFromLink(link: string): number | null {
	try {
		const url = new URL(link)
		if (!/themoviedb\.org$/i.test(url.hostname) && !/www\.themoviedb\.org$/i.test(url.hostname)) return null
		const match = url.pathname.match(/\/movie\/(\d+)/)
		if (!match) return null
		const id = parseInt(match[1], 10)
		return Number.isFinite(id) ? id : null
	} catch {
		return null
	}
}

export async function resolveRowToTMDBMovie(
	row: WatchlistImportRow,
	fetchFn: typeof fetch
): Promise<TMDBMovie | null> {
	const candidates: string[] = []
	if (row.title) candidates.push(row.title)
	if (row.originalTitle && row.originalTitle !== row.title) candidates.push(row.originalTitle)

	if (row.link) {
		const tmdbId = extractTmdbIdFromLink(row.link)
		if (tmdbId) {
			try {
				const detail = await fetchMovieDetail(tmdbId, fetchFn)
				return {
					id: detail.id,
					title: detail.title,
					overview: detail.overview,
					poster_path: detail.poster_path,
					backdrop_path: detail.backdrop_path,
					release_date: detail.release_date,
					vote_average: detail.vote_average,
					vote_count: detail.vote_count,
					genre_ids: detail.genre_ids ?? detail.genres?.map(g => g.id) ?? [],
					original_language: detail.original_language,
					popularity: detail.popularity
				}
			} catch {
				// fall back to search
			}
		}
	}

	for (const query of candidates) {
		const results = await searchMovies(query, { year: row.year ?? undefined, fetchFn })
		if (results.length === 0) continue

		const year = row.year
		const want = normalizeTitle(query)

		let best: TMDBMovie | null = null
		let bestScore = -Infinity
		for (const movie of results) {
			let score = 0
			const titleNorm = normalizeTitle(movie.title)
			if (titleNorm === want) score += 10
			else if (titleNorm.includes(want) || want.includes(titleNorm)) score += 6
			if (year) {
				const movieYear = parseMaybeYear(movie.release_date)
				if (movieYear === year) score += 5
			}
			score += (movie.popularity ?? 0) / 100
			if (score > bestScore) {
				bestScore = score
				best = movie
			}
		}

		if (best) return best
	}

	return null
}

export function isMovieRow(row: WatchlistImportRow): boolean {
	const type = (row.type ?? '').trim().toLowerCase()
	if (!type) return true // assume movie if missing
	return ['movie', 'film', 'm', 'mov'].includes(type)
}
