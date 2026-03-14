# CineList

A lightweight, installable (PWA) movie & TV watchlist built with SvelteKit.

- Discover what’s trending
- Search movies & series
- Open full detail pages (movie/TV)
- Keep a persistent watchlist and mark items as “On Server”
- Quickly preview details in a modal without leaving the grid/list

## Features

- **Trending feed**: shows “Trending This Week” from TMDB.
- **Search**: multi-search across movies and TV shows.
- **Details**:
	- Movie details load from TMDB with optional OMDb enrichment (ratings, etc.).
	- TV details load from TMDB.
	- Trailer playback uses an embedded YouTube (nocookie) iframe.
- **Watchlist**:
	- Add/remove items with optimistic UI updates.
	- Press & hold the watchlist button to **save + mark as saved in library** in one gesture.
	- Toggle an **“On Server”** state (useful if you run a Plex/Jellyfin/etc. setup).
	- Filter tabs: **All / Pending / Saved in Library**.
- **Quick preview modal**:
	- Opens a detail preview via client-side history state.
	- Trigger it via **Shift+Click** on desktop or a short **press & hold** on touch.
	- Expand to the full detail route when needed.
- **CSV import**:
	- Upload a `.csv` to bulk-add movies.
	- Rows are resolved to TMDB movies via TMDB links or a title search.
- **PWA**:
	- Generated service worker + manifest.
	- Caches TMDB images and API responses for faster repeat usage.

## Tech Stack

- Svelte 5 + SvelteKit 2 (TypeScript)
- Vite
- Tailwind CSS
- `vite-plugin-pwa`
- Deno runtime for production (`svelte-adapter-deno`)
- Persistence via `unstorage` (default: Deno KV)

## Architecture

### Routing & data fetching

- Pages are standard SvelteKit routes:
	- `/` trending + watchlist preview
	- `/search` results via TMDB multi-search
	- `/movie/[id]` and `/tv/[id]` detail pages
	- `/watchlist` watchlist management + import

- TMDB calls live in `src/lib/api/tmdb.ts`.
- OMDb lookup (optional) lives in `src/lib/api/omdb.ts`.

### Watchlist persistence

- Server-side persistence is implemented as SvelteKit API endpoints:
	- `GET /api/watchlist`
	- `POST /api/watchlist`
	- `DELETE /api/watchlist/[id]?type=movie|tv`
	- `PATCH /api/watchlist/[id]?type=movie|tv` (toggle “On Server”)
	- `POST /api/watchlist/import` (CSV import)

- Storage is configured in `storage.config.ts` via `unstorage`.
	- Default backend: **Deno KV**, stored at `./.data/cinelist.kv`.
	- You can swap drivers (filesystem, memory, redis, …) in that file.

### Client state

- The watchlist is mirrored in a Svelte store (`src/lib/stores/watchlist.ts`) and kept in sync via the API.

## Setup

### Requirements

- Node.js (for dev tooling and bundling)
- Deno (for running the production build and the default Deno KV storage backend)

### Install

```sh
npm install
```

### Environment variables

Create a `.env` file (used by Vite/SvelteKit during development builds):

```env
# Required
PUBLIC_TMDB_API_KEY=YOUR_TMDB_API_KEY

# Optional (enables extra movie metadata enrichment)
PUBLIC_OMDB_API_KEY=YOUR_OMDB_KEY
```

Notes:

- These are **public** SvelteKit env vars (prefixed with `PUBLIC_`).
- When running the built Deno server, you must also provide these env vars to the process.

## Development

This project targets **Deno** as the production runtime (via `svelte-adapter-deno`).

- **Frontend/dev server** (fast iteration):

```sh
npm run dev
```

If you want watchlist persistence during development, ensure your storage backend is compatible with the runtime running your server routes.
By default the project uses **Deno KV** (see `storage.config.ts`), which is intended for the Deno runtime.

Alternative for Node-based dev: switch the storage driver in `storage.config.ts` to a Node-friendly backend (e.g. filesystem) while developing.

## Build & Run (Deno)

Build a production bundle:

```sh
npm run build
```

Run the generated Deno server:

```sh
deno run -A build/index.js
```

Common runtime env vars for the server:

- `HOST` (default `0.0.0.0`)
- `PORT` (default `3000`)

If you keep secrets in a local `.env`, you may prefer Deno’s env-file support:

```sh
deno run -A --env-file=.env build/index.js
```

## CSV Import

The Watchlist import accepts a `.csv` with either:

- a header row containing columns like `type`, `title`, `originalTitle`, `year`, `link`, or
- a simple positional format.

If a row contains a TMDB movie link, it will be used directly; otherwise the importer searches TMDB by title (and year when present).

Notes:

- The importer is movie-focused: non-movie rows are skipped.
- For the best results, include a `link` to the TMDB movie page or provide `title` + `year`.

## Scripts

- `npm run dev` – start dev server
- `npm run build` – build production bundle
- `npm run preview` – preview the production build (tooling preview)
- `npm run check` – typecheck with Svelte

Deno task equivalents (see `deno.json`):

- `deno task dev` – runs `deno task check` then starts the dev server
- `deno task build` – build production bundle
- `deno task preview` – preview build
- `deno task check` – typecheck with Svelte
