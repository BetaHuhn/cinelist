import { error, type Handle } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'

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
		"frame-src https://www.youtube.com https://www.youtube-nocookie.com",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'"
	].join('; ')
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

const CSRF_ALLOWED_ORIGINS = new Set(
	(env.CSRF_ALLOWED_ORIGINS ?? '')
		.split(',')
		.map((value) => value.trim().toLowerCase())
		.filter(Boolean)
)

function isAllowedCsrfOrigin(originHeader: string): boolean {
	let parsedOrigin: URL

	try {
		parsedOrigin = new URL(originHeader)
	} catch {
		return false
	}

	const requestOrigin = parsedOrigin.origin.toLowerCase()
	const requestHost = parsedOrigin.host.toLowerCase()

	return (
		CSRF_ALLOWED_ORIGINS.has(requestOrigin) ||
		CSRF_ALLOWED_ORIGINS.has(requestHost)
	)
}

export const handle: Handle = async ({ event, resolve }) => {
	// CSRF protection: if configured, only allow mutating API requests from
	// explicitly allowed origins/hosts.
	if (
		CSRF_ALLOWED_ORIGINS.size > 0 &&
		event.url.pathname.startsWith('/api/') &&
		MUTATING_METHODS.has(event.request.method)
	) {
		const origin = event.request.headers.get('origin')
		if (!origin || !isAllowedCsrfOrigin(origin)) {
			error(403, 'Forbidden')
		}
	}

	const response = await resolve(event)

	for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
		response.headers.set(header, value)
	}

	return response
}
