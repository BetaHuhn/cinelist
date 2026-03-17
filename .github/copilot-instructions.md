# Copilot Instructions for CineList

## Project Overview

CineList is a lightweight, installable (PWA) movie & TV watchlist built with **Svelte 5 + SvelteKit 2** (TypeScript) and deployed on the **Deno** runtime. It uses TMDB as the primary data source and optionally enriches movie metadata with OMDb.

## Tech Stack

- **Svelte 5 + SvelteKit 2** with TypeScript — all UI and routing
- **Tailwind CSS v4** via `@tailwindcss/postcss` — utility-first styling
- **Deno** runtime in production via `svelte-adapter-deno`
- **unstorage** for key-value persistence (default backend: Deno KV at `./.data/cinelist.kv`)
- **vite-plugin-pwa** for service worker and PWA manifest generation
- **d3-force** for the graph view in the library

## Repository Structure

```
src/
  app.css              # Global Tailwind entry
  app.html             # HTML shell
  hooks.server.ts      # Security headers + CSRF protection
  lib/
    api/               # TMDB and OMDb API clients (server-only)
    import/            # CSV watchlist importer
    kv/                # Deno KV read/write helpers (watchlist, people, config, blacklist)
    stores/            # Svelte client-side stores (watchlist, people, toast, blacklist)
    types/             # TypeScript types (app.ts, tmdb.ts, config.ts, …)
    utils/             # Shared utilities (validation, graph, …)
  routes/
    +layout.svelte     # App shell (nav, toast, skip link)
    +page.svelte        # Discover home
    api/               # SvelteKit API endpoints (JSON)
    library/           # Library management, blacklist, import
    movie/[id]/        # Movie detail page
    tv/[id]/           # TV detail page
    person/[id]/       # Person detail page
    search/            # Search results
  components/          # Reusable Svelte components (ui/, search/, watchlist/, library/, …)
storage.config.ts      # unstorage driver configuration
```

## Development Commands

```sh
npm install            # Install dependencies
npm run dev            # Start Vite dev server
npm run build          # Production build (Deno adapter)
npm run check          # Svelte type-check (svelte-check)
npm run check:watch    # Type-check in watch mode
```

Deno task equivalents are also available (`deno task dev`, `deno task build`, etc.).

## Environment Variables

| Variable              | Required | Purpose                                      |
|-----------------------|----------|----------------------------------------------|
| `PUBLIC_TMDB_API_KEY` | Yes      | TMDB API key (used server-side via private env) |
| `PUBLIC_OMDB_API_KEY` | No       | OMDb API key for enriched ratings             |
| `CSRF_ALLOWED_ORIGINS`| No       | Comma-separated origins allowed for mutating API requests |
| `HOST` / `PORT`       | No       | Bind address for the Deno server (defaults: `0.0.0.0` / `3000`) |

Despite the `PUBLIC_` prefix in SvelteKit convention, TMDB and OMDb keys are only accessed server-side (via `$env/dynamic/private`) — never expose them in client code.

## Code Conventions

### TypeScript
- All files use TypeScript. Define types in `src/lib/types/` and import them explicitly.
- Prefer `interface` for object shapes and `type` for unions/aliases.
- Use `import type` where only types are imported.

### Svelte
- Use **Svelte 5** runes and syntax (`$state`, `$derived`, `$effect`, `$props`).
- Components live in `src/components/` organized by feature area.
- Keep components focused; extract sub-components when they grow large.
- Page-level data fetching is done exclusively in `+page.server.ts` (or `+layout.server.ts`) — never fetch TMDB/OMDb directly from client components.

### API Routes
- All server-side API endpoints live under `src/routes/api/`.
- Return JSON responses using SvelteKit's `json()` helper.
- Validate and sanitize all user-supplied input. Use helpers in `src/lib/utils/validation.ts` (e.g., `isValidTmdbPath`, `maxLength`).
- CSRF protection for mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) to `/api/*` is enforced in `hooks.server.ts` when `CSRF_ALLOWED_ORIGINS` is configured.

### Styling
- Use Tailwind CSS utility classes. Avoid custom CSS unless strictly necessary.
- Global styles belong in `src/app.css`.

### Security
- API keys (`TMDB_API_KEY`, `OMDB_API_KEY`) must always be accessed via `$env/dynamic/private` and kept server-side only.
- Security headers (CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) are set centrally in `src/hooks.server.ts`.
- Always validate external URLs with exact hostname comparison (not suffix matching) to prevent bypass attacks.

### Persistence (KV)
- All KV read/write logic lives in `src/lib/kv/`. Do not access unstorage directly from routes — add a helper function there instead.
- KV keys follow the pattern `<prefix>:<id>` (e.g., `watchlist:movie:123`).

### Client Stores
- Client-side state is managed in `src/lib/stores/` using Svelte stores.
- Stores mirror server state and are kept in sync via the API — always perform server mutations through the API endpoints and update the store optimistically or reactively.

## Key Patterns

- **Optimistic UI**: Watchlist add/remove operations update the store immediately and roll back on API error.
- **Quick Preview Modal**: Triggered by Shift+Click (desktop) or press & hold (touch) — uses `history.pushState` for URL state.
- **Multi-state workflow**: Items progress through `watchlist → saved in library → watched`; the PATCH endpoint handles state toggling.
- **Accessibility**: Layout includes a skip-to-main-content link; interactive components use appropriate ARIA roles (`combobox`, `listbox`, `option`); toasts use an `aria-live` announcer.

## Testing

There is no automated test suite in this repository. Validate changes by:
1. Running `npm run check` to catch TypeScript/Svelte type errors.
2. Running `npm run dev` and exercising the relevant UI flows manually.
3. Using `npm run build` to confirm the production build succeeds.
