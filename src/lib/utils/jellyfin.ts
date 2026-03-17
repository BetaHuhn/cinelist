/**
 * Shared Jellyfin utility functions that can be used in both server and client code.
 */

/** Trim trailing slash from a URL. */
export function normalizeJellyfinUrl(url: string): string {
	return url.replace(/\/+$/, '')
}

/** Build the Jellyfin web UI deep-link to a specific item. */
export function buildJellyfinPlayUrl(baseUrl: string, jellyfinItemId: string): string {
	return `${normalizeJellyfinUrl(baseUrl)}/web/#/details?id=${encodeURIComponent(jellyfinItemId)}`
}
