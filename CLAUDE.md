# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive map visualization of VIA Rail Canada's train routes. Built with TanStack Start (React 19 SSR framework), Vite, and Tailwind CSS v4. Deployed to **Cloudflare Workers** with the basemap served as a **Stadia Maps** hosted style.

## Commands

```bash
bun --bun run dev       # Dev server on port 3000
bun --bun run build     # Production build
bun --bun run preview   # Preview production build
bun --bun run test      # Run Vitest tests
bun --bun run lint      # ESLint (TanStack config)
bun --bun run format    # Prettier (with tailwindcss plugin)
bun --bun run typecheck # tsc --noEmit
bun --bun run deploy    # Typecheck, build, and deploy to Cloudflare Workers
bun --bun run cf-typegen # Generate Cloudflare Worker types
bun run fixture:capture  # Snapshot VIA's live tracker into a test fixture (args in README)
```

Package manager is **Bun**.

## Architecture

- **Framework**: TanStack Start with file-based routing (`src/routes/`)
- **Styling**: Tailwind CSS v4 + shadcn/ui components (base-nova style)
- **Data**: The site publishes GTFS and GTFS-Realtime feeds at `/gtfs` and `/gtfs-rt/*`, and the frontend consumes its own feeds rather than the raw tracker JSON
- **Map**: MapLibre GL JS via react-map-gl, with a Stadia Maps hosted style (`alidade_smooth_dark`) as the basemap. Production auth is domain-based (configured in the Stadia dashboard); localhost needs no API key
- **Validation**: Zod for data schemas
- **Route tree**: Auto-generated at `src/routeTree.gen.ts` — do not edit manually
- **Path aliases**: `@/*` maps to `./src/*`
- **Deployment**: Cloudflare Workers (`wrangler.jsonc`)

### Key directories

- `src/routes/` — File-based routes. `__root.tsx` is the root layout
  - `src/routes/train/$trainId.tsx` — Individual train detail page
- `src/components/` — App-level components (map, sidebar, train timeline, etc.)
- `src/components/ui/` — shadcn/ui primitives
- `src/hooks/` — Custom React hooks (e.g., `use-mobile.ts`)
- `src/server/` — Server-side logic: train data fetching, transformation, and Zod schemas
- `src/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- `data/gtfs/viarail.zip` — VIA's published GTFS schedule feed, committed as the source of truth. `scripts/build-gtfs.ts` (`bun run gtfs:build`) turns it into typed tables in `src/data/gtfs/` and a redistributable copy plus deduplicated route geometry in `public/gtfs/`. Both output directories are generated and committed; edit the script, never the output. CI fails if they drift
- `src/data/gtfs.ts` — typed barrel over the generated tables, with lookup maps (`stopByCode` joins the live tracker's station codes to GTFS stops)
- `src/server/gtfs-rt/` — converts the live tracker JSON into GTFS-Realtime. `resolve-trip.ts` maps a train number to a scheduled trip, `align-stops.ts` matches the tracker's stop list onto that trip, `build-feed.ts` produces the three FeedMessages, `serve.ts` encodes them for `/gtfs-rt/$feed`
- `src/lib/view-model.ts` — turns the feeds plus the schedule into what the UI renders

### Tests

Nothing in the suite touches VIA or traincar.info. Tests replay committed
captures of the tracker from `src/server/__tests__/fixtures/` through the real
pipeline (`parseAllTrainData` → `buildFeeds` → `toTrainViews`) with a `now`
pinned to the capture's poll time, which is what makes stop statuses
deterministic.

Component tests are `src/components/__tests__/*.test.tsx` and need a
`@vitest-environment jsdom` docblock, since the default environment is node.
They mock the two I/O seams only, `use-train-views` and `use-train-consist`, so
that everything below the component is the real thing.

### shadcn/ui

UI components come from shadcn/ui (base-nova style). When adding or working with shadcn components, use the **shadcn MCP tools** (`mcp__shadcn__*`) to look up available components, view examples, and get the correct install commands rather than guessing.

### Theming

Theme colors are defined via CSS variables in `src/styles.css` with light and dark variants. The dark variant is activated by the `.dark` class on `<html>`.
