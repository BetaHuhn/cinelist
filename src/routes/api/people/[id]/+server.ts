import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { removeFavoritePerson } from '$lib/kv/people'
import { clearHomeRecommendationsCache } from '$lib/kv/recommendations'

export const DELETE: RequestHandler = async ({ params }) => {
	const id = Number(params.id)
	if (!Number.isFinite(id)) return json({ message: 'Invalid id' }, { status: 400 })
	await removeFavoritePerson(id)
	await clearHomeRecommendationsCache()
	return json({ ok: true })
}
