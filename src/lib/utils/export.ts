import type { WatchlistItem } from '$lib/types/app'

function escapeCsvField(value: string): string {
	if (value.includes(',') || value.includes('"') || value.includes('\n')) {
		return `"${value.replace(/"/g, '""')}"`
	}
	return value
}

export function exportWatchlistToCSV(items: WatchlistItem[]): void {
	const header = 'type,title,year,link'
	const rows = items.map((item) => {
		const year = item.release_date ? new Date(item.release_date).getFullYear() : ''
		const tmdbPath = item.mediaType === 'tv' ? `tv/${item.id}` : `movie/${item.id}`
		const link = `https://www.themoviedb.org/${tmdbPath}`
		return [escapeCsvField(item.mediaType), escapeCsvField(item.title), String(year), link].join(
			','
		)
	})
	const csv = [header, ...rows].join('\n')
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = 'cinelist-watchlist.csv'
	a.click()
	setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
