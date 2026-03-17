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
 * Fetch all movie and series items from the Jellyfin library, paginating as
 * needed.  This is the recommended way to sync in Jellyfin 10.11+ where the
 * AnyProviderIdEquals query parameter is known to be broken.
 */
export async function getLibraryItems(
baseUrl: string,
apiKey: string,
userId: string
): Promise<JellyfinItem[]> {
const allItems: JellyfinItem[] = []
const pageSize = 500
let startIndex = 0
let total: number | null = null

do {
const url = new URL(`${normalizeJellyfinUrl(baseUrl)}/Users/${encodeURIComponent(userId)}/Items`)
url.searchParams.set('IncludeItemTypes', 'Movie,Series')
url.searchParams.set('Recursive', 'true')
url.searchParams.set('Fields', 'ProviderIds,UserData')
url.searchParams.set('Limit', String(pageSize))
url.searchParams.set('StartIndex', String(startIndex))

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
allItems.push(...(data.Items ?? []))
total = data.TotalRecordCount
startIndex += pageSize
} while (startIndex < (total ?? 0))

return allItems
}
