// @ts-nocheck

import { buildMoodRecommendations } from './moodRecommendations.ts'

Deno.test('ranks ready watchlist items ahead of pending ones for a cozy mood', () => {
	const candidates = buildMoodRecommendations(
		[
			{
				mediaType: 'movie',
				id: 101,
				title: 'Pending Cozy Drama',
				poster_path: null,
				backdrop_path: null,
				release_date: '2023-01-01',
				vote_average: 8.2,
				genre_ids: [18, 10751],
				addedAt: Date.now(),
				onMediaServer: false,
				watched: false,
				userRating: 8
			},
			{
				mediaType: 'movie',
				id: 202,
				title: 'Ready Cozy Comedy',
				poster_path: null,
				backdrop_path: null,
				release_date: '2022-01-01',
				vote_average: 7.8,
				genre_ids: [35, 10751],
				addedAt: Date.now(),
				onMediaServer: true,
				watched: false,
				userRating: 9
			}
		],
		'cozy',
		[]
	)

	if (candidates[0]?.id !== 202) throw new Error(`Expected first candidate to be 202, got ${candidates[0]?.id}`)
	if (candidates[0]?.onMediaServer !== true) throw new Error('Expected the ready item to rank first')
	if (!(candidates[0]?.score > (candidates[1]?.score ?? -Infinity))) throw new Error('Expected the leading candidate to outrank the second one')
})
