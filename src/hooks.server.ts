import { error, type Handle } from '@sveltejs/kit'
import { dev } from '$app/environment'

const SECURITY_HEADERS: Record<string, string> = {
	'X-Frame-Options': 'DENY',
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
	'Content-Security-Policy': [
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline'",
		"style-src 'self' 'unsafe-inline' https://rsms.me",
		"font-src 'self' https://rsms.me",
		"img-src 'self' data: https://image.tmdb.org",
		"connect-src 'self'",
		"frame-src https://www.youtube.com",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'"
	].join('; ')
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export const handle: Handle = async ({ event, resolve }) => {
	// CSRF protection: reject cross-origin mutating API requests.
	if (
		!dev &&
		event.url.pathname.startsWith('/api/') &&
		MUTATING_METHODS.has(event.request.method)
	) {
		const origin = event.request.headers.get('origin')
		if (origin && origin !== event.url.origin) {
			error(403, 'Forbidden')
		}
	}

	const response = await resolve(event)

	for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
		response.headers.set(header, value)
	}

	return response
}
