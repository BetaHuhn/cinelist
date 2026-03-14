import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
	plugins: [
		sveltekit(),
		VitePWA({
			strategies: 'generateSW',
			registerType: 'autoUpdate',
			// Tell vite-plugin-pwa where SvelteKit's built client lives
			outDir: '.svelte-kit/output/client',
			// Don't inject the SW registration script — we do it manually
			// in the layout so it only runs on the client
			injectRegister: null,
			manifest: {
				name: 'CineList',
				short_name: 'CineList',
				description: 'Your personal movie watchlist',
				theme_color: '#0a0a0f',
				background_color: '#06060a',
				display: 'standalone',
				orientation: 'portrait',
				start_url: '/',
				icons: [
					{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
					{
						src: '/icons/maskable-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				// Ensure the SW can serve SvelteKit's output
				globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/image\.tmdb\.org\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'tmdb-images',
							expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
							cacheableResponse: { statuses: [0, 200] }
						}
					},
					{
						urlPattern: /^https:\/\/api\.themoviedb\.org\/.*/i,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'tmdb-api',
							expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
							cacheableResponse: { statuses: [0, 200] }
						}
					}
				]
			}
		})
	]
})
