import type { Handle } from '@sveltejs/kit'

const CSP = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline'",
	"style-src 'self' 'unsafe-inline' https://rsms.me",
	"img-src 'self' https://image.tmdb.org data: blob:",
	"font-src 'self' https://rsms.me",
	"frame-src https://www.youtube-nocookie.com",
	"connect-src 'self' https://api.themoviedb.org https://www.omdbapi.com",
	"worker-src 'self' blob:",
	"object-src 'none'",
	"base-uri 'self'"
].join('; ')

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event)

	response.headers.set('X-Content-Type-Options', 'nosniff')
	response.headers.set('X-Frame-Options', 'SAMEORIGIN')
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
	response.headers.set('Content-Security-Policy', CSP)

	return response
}
