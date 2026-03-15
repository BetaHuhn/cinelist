import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { addFavoritePerson, getFavoritePeople } from '$lib/kv/people'
import { clearHomeRecommendationsCache } from '$lib/kv/recommendations'
import type { FavoritePerson } from '$lib/types/app'
import { isValidTmdbPath, maxLength } from '$lib/utils/validation'

export const GET: RequestHandler = async () => {
	const items = await getFavoritePeople()
	return json(items)
}

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as Partial<Omit<FavoritePerson, 'addedAt'>>
	const id = typeof body.id === 'number' ? body.id : Number(body.id)
	if (!Number.isFinite(id)) return json({ message: 'Invalid id' }, { status: 400 })
	if (typeof body.name !== 'string' || !body.name.trim()) {
		return json({ message: 'Missing name' }, { status: 400 })
	}
	if (maxLength(body.name, 200) === null) {
		return json({ message: 'Name too long' }, { status: 400 })
	}
	if (body.known_for_department != null && typeof body.known_for_department === 'string') {
		if (maxLength(body.known_for_department, 100) === null) {
			return json({ message: 'Known_for_department too long' }, { status: 400 })
		}
	}
	if (body.profile_path != null && !isValidTmdbPath(body.profile_path)) {
		return json({ message: 'Invalid profile_path' }, { status: 400 })
	}

	const item = await addFavoritePerson({
		id,
		name: body.name.trim(),
		profile_path: typeof body.profile_path === 'string' ? body.profile_path : null,
		known_for_department:
			typeof body.known_for_department === 'string' ? body.known_for_department : null
	})

	await clearHomeRecommendationsCache()
	return json(item)
}
