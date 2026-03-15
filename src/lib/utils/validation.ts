/** Validates a TMDB image path (e.g. "/abc123.jpg"). Must start with / and contain only safe characters. */
export function isValidTmdbPath(value: unknown): value is string {
	return typeof value === 'string' && /^\/[a-zA-Z0-9/_.-]+$/.test(value)
}

/** Returns the string if it is within maxLen chars, otherwise null (signals invalid input). */
export function maxLength(value: string, maxLen: number): string | null {
	return value.length <= maxLen ? value : null
}
