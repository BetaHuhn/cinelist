/** Regex that matches TMDB image paths such as `/abc123.jpg`. */
const PATH_RE = /^\/[a-zA-Z0-9/_.-]+$/

/**
 * Returns true when `value` is either `null`/`undefined` (allowed as "no image")
 * or a string that looks like a valid TMDB image path.
 */
export function isValidTmdbPath(value: unknown): value is string | null {
	if (value === null || value === undefined) return true
	if (typeof value !== 'string') return false
	if (value === '') return true
	return PATH_RE.test(value)
}
