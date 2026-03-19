import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getConfigOption } from '$lib/kv/app-config'

export const GET: RequestHandler = async () => {
	const [url, name] = await Promise.all([
		getConfigOption('customProviderUrl'),
		getConfigOption('customProviderName')
	])
	return json({ url, name })
}
