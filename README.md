<p align="center">
  <img alt="CineList" src="./static/icons/icon-512.png" width="96">
</p>

<h3 align="center">CineList</h3>

<p align="center">
  A lightweight, installable (PWA) movie &amp; TV watchlist
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#tech-stack"><strong>Tech Stack</strong></a> ·
  <a href="#architecture"><strong>Architecture</strong></a> ·
  <a href="#setup"><strong>Setup</strong></a> ·
  <a href="#development"><strong>Development</strong></a>
</p>

<br/>

## Features

- **Discover home**:
	- "Trending Now" from TMDB.
	- "Recommended for You" generated from your watchlist + favourite people.
	- "From Your Watchlist" and "Ready in Your Library" preview rows.
	- Featured carousel sourced from your own library items.
- **Search**:
	- Multi-search across movies and TV shows.
	- Dedicated people results with direct links to person pages.
- **Details**:
	- Movie details load from TMDB with optional OMDb enrichment (ratings, etc.).
	- TV details load from TMDB.
	- Person pages include biography and curated credits.
	- Trailer playback uses an embedded YouTube (nocookie) iframe.
- **Library / watchlist management**:
	- Add/remove items with optimistic UI updates.
	- Multi-state item workflow: **Watchlist → Saved in Library → Watched**.
	- Press & hold the watchlist button for quick state transitions.
	- Filter tabs: **Ready to Watch / Not in Library / Watched / All**.
	- Media-type filter: Movies, TV shows, or both.
	- Sort by: date added, title, TMDB rating, user rating, or release year.
	- Three display modes: **Card**, **Poster**, and **Graph** views.
	- Favourite people list in library view.
	- Export your watchlist to CSV.
	- Persisted library card-size preference.
- **User ratings**:
	- Rate any item 1–10 stars directly from the library.
	- Ratings feed into the personalised recommendation algorithm.
- **Graph view**:
	- Interactive force-directed graph of your library items.
	- Edges connect items that share genres or TMDB keywords.
	- Node circles display TMDB poster images with genre-colour borders.
- **Jellyfin integration**:
	- Connect to a Jellyfin media server from the Settings page.
	- Syncing marks items as available and links to the Jellyfin player.
	- A **Play** button appears on detail pages for items found on your server.
- **Custom provider**:
	- Configure any search URL (e.g. Prowlarr) as a custom provider.
	- A **Get via…** button appears on detail pages for items not on your media server.
	- Supports `{NAME}`, `{YEAR}`, `{NAME_KEBAB}`, and `{NAME_CAMEL}` placeholders.
- **Quick preview modal**:
	- Opens a detail preview via client-side history state.
	- Trigger it via **Shift+Click** on desktop or a short **press & hold** on touch/pointer.
	- Expand to the full detail route when needed.
- **Blacklist / hidden items**:
	- Hide titles from the Discover home and recommendation results.
	- Manage hidden items from the Library → Hidden Items page.
- **CSV import**:
	- Upload a `.csv` to bulk-add movies.
	- Rows are resolved to TMDB movies via TMDB links or a title search.
- **Keyboard shortcuts**:
	- `/` or `Ctrl/Cmd+K` to focus search.
	- `g h`, `g l`, `g s` to navigate to Home, Library, and Search.
- **PWA**:
	- Generated service worker + manifest — installable on desktop and mobile.
	- Caches TMDB images and API responses for faster repeat usage.

## Tech Stack

- **Svelte 5 + SvelteKit 2** (TypeScript)
- **Tailwind CSS v4** via `@tailwindcss/postcss`
- **Vite** + `vite-plugin-pwa`
- **Deno** runtime for production (`svelte-adapter-deno`)
- **unstorage** for persistence (default: Deno KV at `./.data/cinelist.kv`)
- **d3-force** for the graph view

## Architecture

### Routing & data fetching

Pages are standard SvelteKit routes:

| Route | Description |
|---|---|
| `/` | Discover — trending, featured, recommendations, library previews |
| `/search` | Search results for movies, TV shows, and people |
| `/library` | Library management, import, and export |
| `/library/blacklist` | Manage hidden (blacklisted) items |
| `/movie/[id]` | Movie detail page |
| `/tv/[id]` | TV show detail page |
| `/person/[id]` | Person page — biography and credits |
| `/settings` | Jellyfin integration and custom provider settings |

All TMDB and OMDb calls are server-side only (`src/lib/api/`). API keys are never exposed to the client.

### API endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/watchlist` | Fetch full watchlist |
| `POST` | `/api/watchlist` | Add an item |
| `DELETE` | `/api/watchlist/[id]` | Remove an item (`?type=movie\|tv`) |
| `PATCH` | `/api/watchlist/[id]` | Toggle state (`?toggle=server\|watched\|rating`) |
| `POST` | `/api/watchlist/import` | CSV bulk import |
| `GET` | `/api/featured` | Featured items for the carousel |
| `GET` | `/api/recommendations` | Personalised recommendations |
| `GET` | `/api/people` | Favourite people list |
| `POST` | `/api/people` | Add a favourite person |
| `DELETE` | `/api/people/[id]` | Remove a favourite person |
| `GET` | `/api/blacklist` | Hidden items list |
| `POST` | `/api/blacklist` | Hide an item |
| `DELETE` | `/api/blacklist/[id]` | Un-hide an item |
| `GET` | `/api/graph/keywords` | Keyword edges for the graph view |
| `POST` | `/api/jellyfin/sync` | Sync availability from Jellyfin |
| `GET` | `/api/config/[key]` | Read a config value |
| `PUT` | `/api/config/[key]` | Write a config value |

### Storage

- Configured in `storage.config.ts` via `unstorage`.
- Default backend: **Deno KV**, stored at `./.data/cinelist.kv`.
- You can swap drivers (filesystem, memory, redis, …) in that file.

### Client state

- The watchlist is mirrored in a Svelte store (`src/lib/stores/watchlist.ts`) and kept in sync via the API.
- Favourite people are mirrored in `src/lib/stores/people.ts`.
- Recommendation responses are cached server-side and invalidated on watchlist/people changes.

## Setup

### Requirements

- **Node.js** — for dev tooling and bundling
- **Deno** — for running the production build and the default Deno KV storage backend

### Install

```sh
npm install
```

### Environment variables

Create a `.env` file at the project root:

```env
# Required — TMDB API key (server-side only, never exposed to the client)
TMDB_API_KEY=your_tmdb_api_key_here

# Optional — OMDb API key for enriched ratings (Rotten Tomatoes, Metacritic)
OMDB_API_KEY=your_omdb_api_key_here

# Optional — comma-separated list of allowed origins for mutating API requests
# Leave unset to bypass CSRF checks (e.g. during local development)
CSRF_ALLOWED_ORIGINS=""
```

> **Note:** `TMDB_API_KEY` and `OMDB_API_KEY` are **private** server-side variables accessed via `$env/dynamic/private`. They are never included in the client bundle.

## Development

This project targets **Deno** as the production runtime (via `svelte-adapter-deno`).

Start the dev server:

```sh
npm run dev
# or
deno task dev
```

> **Tip:** The default storage backend is **Deno KV** (`storage.config.ts`), which requires the Deno runtime. For a Node-based dev workflow, switch the driver in `storage.config.ts` to a Node-friendly backend (e.g. filesystem).

## Build & Run (Deno)

Build a production bundle:

```sh
npm run build
# or
deno task build
```

Run the generated Deno server:

```sh
deno run -A --unstable-kv build/index.js
```

To load environment variables from a local `.env` file:

```sh
deno run -A --unstable-kv --env-file=.env build/index.js
```

Common runtime environment variables:

| Variable | Default | Description |
|---|---|---|
| `TMDB_API_KEY` | — | **Required.** TMDB v3 API key |
| `OMDB_API_KEY` | — | Optional. Enables OMDb rating enrichment |
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `3000` | Bind port |
| `CSRF_ALLOWED_ORIGINS` | — | Comma-separated origin allowlist for mutating API requests |

## Build & Run (Docker)

Build the image:

```sh
docker build -t cinelist .
```

Run the container on port `8000`:

```sh
docker run --rm -p 8000:8000 \
	-e TMDB_API_KEY=your_tmdb_api_key_here \
	-e OMDB_API_KEY=your_omdb_api_key_here \
	cinelist
```

## CSV Import

The watchlist importer accepts a `.csv` with either:

- a header row containing columns like `type`, `title`, `originalTitle`, `year`, `link`, or
- a simple positional format.

If a row contains a TMDB movie link it is used directly; otherwise the importer searches TMDB by title (and year when present).

- The importer is movie-focused: non-movie rows are skipped.
- For best results include a `link` to the TMDB movie page or provide `title` + `year`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Build the production bundle |
| `npm run preview` | Preview the production build locally |
| `npm run check` | Type-check with `svelte-check` |
| `npm run check:watch` | Type-check in watch mode |

Deno task equivalents (see `deno.json`):

| Command | Description |
|---|---|
| `deno task dev` | Type-check then start the dev server |
| `deno task build` | Build the production bundle |
| `deno task preview` | Preview the production build |
| `deno task check` | Type-check with `svelte-check` |
