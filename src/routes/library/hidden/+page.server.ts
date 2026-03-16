import { getBlacklist } from '$lib/kv/blacklist'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
	const items = await getBlacklist()
	return { items }
}
