import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getConfigOption } from '$lib/kv/app-config'
import { getWatchlist, updateItem } from '$lib/kv/watchlist'
import { getLibraryItems, validateJellyfinUrl } from '$lib/api/jellyfin'
import type { JellyfinItem } from '$lib/api/jellyfin'
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

	// Fetch all library items at once and build a lookup map keyed by
	// "{jellyfinType}:{tmdbId}".  This works around the AnyProviderIdEquals
	// query parameter being broken in Jellyfin 10.11+.
	let libraryItems: JellyfinItem[]
	try {
		libraryItems = await getLibraryItems(baseUrl, apiKey, userId)
	} catch (e) {
		const msg = (e as Error).message
		error(msg.includes('Could not reach') || msg.includes('authentication failed') ? 502 : 500, msg)
	}

	// Build lookup map: "{movie|series}:{tmdbId}" -> JellyfinItem
	// Jellyfin uses "Movie" and "Series" as type strings; TMDB movie IDs and
	// TV IDs are from separate namespaces, so the compound key avoids collisions.
	const tmdbMap = new Map<string, JellyfinItem>()
	for (const jellyfinItem of libraryItems) {
		const tmdbId = jellyfinItem.ProviderIds?.Tmdb ?? jellyfinItem.ProviderIds?.tmdb
		if (tmdbId) {
			const type = jellyfinItem.Type.toLowerCase() // "movie" or "series"
			tmdbMap.set(`${type}:${tmdbId}`, jellyfinItem)
		}
	}

	let syncedCount = 0
	let onServerCount = 0
	let watchedCount = 0

	await Promise.all(
		items.map(async (item: WatchlistItem) => {
			const jellyfinType = item.mediaType === 'movie' ? 'movie' : 'series'
			const jellyfinItem = tmdbMap.get(`${jellyfinType}:${item.id}`) ?? null
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

	const updatedItems = await getWatchlist()
	return json({ synced: syncedCount, onServer: onServerCount, watched: watchedCount, items: updatedItems })
}
