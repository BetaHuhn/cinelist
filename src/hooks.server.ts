import type { Handle } from '@sveltejs/kit'

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event)

	const csp = [
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline'",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: https://image.tmdb.org",
		"frame-src https://www.youtube-nocookie.com",
		"connect-src 'self'",
		"object-src 'none'",
		"base-uri 'self'",
	].join('; ')

	response.headers.set('Content-Security-Policy', csp)
	response.headers.set('X-Frame-Options', 'SAMEORIGIN')
	response.headers.set('X-Content-Type-Options', 'nosniff')
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
	response.headers.set(
		'Permissions-Policy',
		'camera=(), microphone=(), geolocation=()'
	)

	return response
}
