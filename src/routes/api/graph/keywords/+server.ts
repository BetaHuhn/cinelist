import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { fetchMovieKeywords, fetchTVKeywords } from '$lib/api/tmdb'

const MAX_ITEMS = 500
const CONCURRENCY = 10

type MediaType = 'movie' | 'tv'

interface ParsedItem {
	key: string
	id: number
	mediaType: MediaType
}

/**
 * Bounded parallel mapper – runs at most `concurrency` promises at a time.
 */
async function mapLimit<T, R>(
	items: T[],
	concurrency: number,
	fn: (item: T) => Promise<R>
): Promise<Array<R | null>> {
	const results: Array<R | null> = new Array(items.length).fill(null)
	let next = 0
	const worker = async () => {
		while (true) {
			const idx = next++
			if (idx >= items.length) return
			try {
				results[idx] = await fn(items[idx])
			} catch {
				// Leave null on error – the graph just won't have keyword edges for this item.
			}
		}
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
	return results
}

/**
 * GET /api/graph/keywords?items=movie:550,tv:456,...
 *
 * Returns a map of `"mediaType:id"` → sorted array of keyword IDs for each
 * requested watchlist item. Unknown or failed items are omitted.
 */
export const GET: RequestHandler = async ({ url, fetch }) => {
	const raw = url.searchParams.get('items')
	if (!raw?.trim()) return json({})

	const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
	if (parts.length > MAX_ITEMS) error(400, `Too many items requested (max ${MAX_ITEMS})`)

	const parsed: ParsedItem[] = []
	for (const part of parts) {
		const [mediaType, idStr] = part.split(':')
		if (mediaType !== 'movie' && mediaType !== 'tv') continue
		const id = parseInt(idStr, 10)
		if (!Number.isFinite(id) || id <= 0) continue
		parsed.push({ key: `${mediaType}:${id}`, id, mediaType })
	}

	if (parsed.length === 0) return json({})

	const kwLists = await mapLimit(parsed, CONCURRENCY, async ({ id, mediaType }) => {
		const kws =
			mediaType === 'movie'
				? await fetchMovieKeywords(id, fetch)
				: await fetchTVKeywords(id, fetch)
		return kws.map((k) => k.id)
	})

	const result: Record<string, number[]> = {}
	for (let i = 0; i < parsed.length; i++) {
		const list = kwLists[i]
		if (list && list.length > 0) {
			result[parsed[i].key] = list
		}
	}

	return json(result)
}
