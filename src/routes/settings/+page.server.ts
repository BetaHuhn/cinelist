import { getConfigOption } from '$lib/kv/app-config'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
	const [jellyfinUrl, jellyfinUserId] = await Promise.all([
		getConfigOption('jellyfinUrl'),
		getConfigOption('jellyfinUserId')
	])

	// Note: jellyfinApiKey is intentionally not included in the server load to
	// avoid it being serialized into the page HTML. The settings form lets the
	// user enter/re-enter the key but never pre-fills it.
	return { jellyfinUrl, jellyfinUserId }
}
