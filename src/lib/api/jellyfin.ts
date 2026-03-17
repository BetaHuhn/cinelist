/**
 * Server-side Jellyfin API client.
 * Never import this from client-side code — it uses private credentials from KV.
 */

import { normalizeJellyfinUrl } from '$lib/utils/jellyfin'
export { buildJellyfinPlayUrl as buildPlayUrl } from '$lib/utils/jellyfin'

export interface JellyfinUserData {
Played: boolean
PlayCount: number
IsFavorite: boolean
}

export interface JellyfinItem {
Id: string
Name: string
Type: string
UserData: JellyfinUserData
ProviderIds: Record<string, string>
}

interface JellyfinItemsResponse {
Items: JellyfinItem[]
TotalRecordCount: number
}

/**
 * Validate that a URL uses http or https and has a non-empty host.
 * Returns the normalized base URL string, or throws on invalid input.
 */
export function validateJellyfinUrl(raw: string): string {
let parsed: URL
try {
parsed = new URL(raw)
} catch {
throw new Error('Jellyfin URL is not a valid URL')
}
if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
throw new Error('Jellyfin URL must use http or https')
}
if (!parsed.host) {
throw new Error('Jellyfin URL must include a host')
}
return normalizeJellyfinUrl(raw)
}

function authHeaders(apiKey: string): Record<string, string> {
return {
'X-Emby-Token': apiKey,
Accept: 'application/json'
}
}

/**
 * Look up a single item in Jellyfin by its TMDB ID.
 * Returns the matching item (with UserData), or null if not found.
 *
 * After receiving the response we also verify that the returned item's
 * ProviderIds actually contain the expected TMDB ID.  Some Jellyfin versions
 * silently ignore the AnyProviderIdEquals query parameter and return all
 * items (up to Limit:1); without this check every watchlist entry would be
 * falsely marked as "on server".
 */
export async function findByTmdbId(
baseUrl: string,
apiKey: string,
userId: string,
tmdbId: number,
mediaType: 'movie' | 'tv'
): Promise<JellyfinItem | null> {
const type = mediaType === 'movie' ? 'Movie' : 'Series'
const url = new URL(`${normalizeJellyfinUrl(baseUrl)}/Users/${encodeURIComponent(userId)}/Items`)
url.searchParams.set('AnyProviderIdEquals', `Tmdb.${tmdbId}`)
url.searchParams.set('IncludeItemTypes', type)
url.searchParams.set('Recursive', 'true')
url.searchParams.set('Fields', 'ProviderIds,UserData')
url.searchParams.set('Limit', '1')

let res: Response
try {
res = await fetch(url.toString(), { headers: authHeaders(apiKey) })
} catch (err) {
throw new Error(`Could not reach Jellyfin server: ${(err as Error).message}`)
}

if (res.status === 401 || res.status === 403) {
throw new Error('Jellyfin authentication failed — check your API key and User ID')
}
if (!res.ok) {
throw new Error(`Jellyfin returned HTTP ${res.status}`)
}

const data = (await res.json()) as JellyfinItemsResponse
const item = data.Items?.[0] ?? null
if (!item) return null

// Verify the returned item actually has the TMDB ID we queried.
// Jellyfin stores provider IDs with a capital "Tmdb" key, but check
// lowercase "tmdb" as well for older/non-standard installations.
const providerTmdbId = item.ProviderIds?.Tmdb ?? item.ProviderIds?.tmdb
if (providerTmdbId !== String(tmdbId)) return null

return item
}
