const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

export function posterUrl(path: string | null | undefined, size: 'w92' | 'w185' | 'w342' | 'w500' = 'w342'): string {
	if (!path) return '/placeholder-poster.svg'
	return `${TMDB_IMAGE_BASE}/${size}${path}`
}

export function backdropUrl(path: string | null | undefined, size: 'w780' | 'w1280' | 'original' = 'w1280'): string {
	if (!path) return ''
	return `${TMDB_IMAGE_BASE}/${size}${path}`
}

export function profileUrl(path: string | null | undefined, size: 'w45' | 'w185' = 'w185'): string {
	if (!path) return '/placeholder-avatar.svg'
	return `${TMDB_IMAGE_BASE}/${size}${path}`
}
