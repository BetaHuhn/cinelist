import { pushState } from '$app/navigation'
import type { MediaType } from '$lib/types/app'

function toPath(url: URL): string {
	return `${url.pathname}${url.search}${url.hash}`
}

export function openDetailPreview(opts: {
	mediaType: MediaType
	id: number
	fromUrl: URL
	fromOverride?: string
}): void {
	const href = opts.mediaType === 'tv' ? `/tv/${opts.id}` : `/movie/${opts.id}`
	const from = opts.fromOverride ?? toPath(opts.fromUrl)
	pushState(href, { preview: { mediaType: opts.mediaType, id: opts.id, from } })
}
