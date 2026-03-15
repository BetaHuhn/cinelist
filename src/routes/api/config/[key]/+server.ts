import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getConfigOption, isAppConfigKey, setConfigOption } from '$lib/kv/app-config'

export const GET: RequestHandler = async ({ params }) => {
	const key = params.key
	if (!isAppConfigKey(key)) {
		return json({ message: 'Invalid config key' }, { status: 400 })
	}

	const value = await getConfigOption(key)
	return json({ key, value })
}

export const PUT: RequestHandler = async ({ params, request }) => {
	const key = params.key
	if (!isAppConfigKey(key)) {
		return json({ message: 'Invalid config key' }, { status: 400 })
	}

	const body = (await request.json()) as { value?: unknown }
	if (!('value' in body)) {
		return json({ message: 'Missing value' }, { status: 400 })
	}

	const value = await setConfigOption(key, body.value)
	return json({ key, value })
}
