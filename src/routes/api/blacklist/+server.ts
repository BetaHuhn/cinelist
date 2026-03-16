import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getBlacklist, addBlacklistItem } from '$lib/kv/blacklist'
import type { BlacklistItem } from '$lib/types/app'

export const GET: RequestHandler = async () => {
	const items = await getBlacklist()
	return json(items)
}

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as Partial<Omit<BlacklistItem, 'addedAt'>>
	const mediaType = body.mediaType === 'tv' ? 'tv' : 'movie'
	const id = typeof body.id === 'number' ? body.id : Number(body.id)
	if (!Number.isFinite(id) || id <= 0) {
		return json({ message: 'Invalid id' }, { status: 400 })
	}
	if (typeof body.title !== 'string' || !body.title.trim()) {
		return json({ message: 'Missing title' }, { status: 400 })
	}

	const item = await addBlacklistItem({
		mediaType,
		id,
		title: body.title.trim(),
		poster_path: typeof body.poster_path === 'string' ? body.poster_path : null
	})
	return json(item, { status: 201 })
}
