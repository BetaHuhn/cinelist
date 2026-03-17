import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getConfigOption } from '$lib/kv/app-config'
import { getWatchlist, updateItem } from '$lib/kv/watchlist'
import { findByTmdbId, validateJellyfinUrl } from '$lib/api/jellyfin'
import type { WatchlistItem } from '$lib/types/app'

export const POST: RequestHandler = async () => {
	const [rawUrl, apiKey, userId] = await Promise.all([
		getConfigOption('jellyfinUrl'),
		getConfigOption('jellyfinApiKey'),
		getConfigOption('jellyfinUserId')
	])

	if (!rawUrl || !apiKey || !userId) {
		error(400, 'Jellyfin is not configured. Please set the server URL, API key, and User ID in Settings.')
	}

	let baseUrl: string
	try {
		baseUrl = validateJellyfinUrl(rawUrl)
	} catch (e) {
		error(400, (e as Error).message)
	}

	const items = await getWatchlist()
	if (items.length === 0) {
		return json({ synced: 0, onServer: 0, watched: 0, items: [] })
	}

	let syncedCount = 0
	let onServerCount = 0
	let watchedCount = 0

	const results = await Promise.allSettled(
		items.map(async (item: WatchlistItem) => {
			const jellyfinItem = await findByTmdbId(baseUrl, apiKey, userId, item.id, item.mediaType)
			if (jellyfinItem) {
				const watched = jellyfinItem.UserData.Played
				const jellyfinItemId = jellyfinItem.Id
				await updateItem(item.mediaType, item.id, { onMediaServer: true, watched, jellyfinItemId })
				onServerCount++
				if (watched) watchedCount++
			} else {
				// Item not found on Jellyfin — mark as unavailable and clear Jellyfin ID.
				await updateItem(item.mediaType, item.id, { onMediaServer: false, jellyfinItemId: undefined })
			}
			syncedCount++
		})
	)

	// Surface the first connectivity/auth error if Jellyfin itself is unreachable.
	for (const result of results) {
		if (result.status === 'rejected') {
			const msg: string = result.reason instanceof Error ? result.reason.message : String(result.reason)
			if (msg.includes('Could not reach') || msg.includes('authentication failed')) {
				error(502, msg)
			}
		}
	}

	const updatedItems = await getWatchlist()
	return json({ synced: syncedCount, onServer: onServerCount, watched: watchedCount, items: updatedItems })
}
