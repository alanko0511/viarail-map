# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive map visualization of VIA Rail Canada's train routes. Built with TanStack Start (React 19 SSR framework), Vite, and Tailwind CSS v4. Deployed to **Cloudflare Workers** with map tiles served from **Cloudflare R2** via PMTiles.

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
```

Package manager is **Bun**.

## Architecture

- **Framework**: TanStack Start with file-based routing (`src/routes/`)
- **Styling**: Tailwind CSS v4 + shadcn/ui components (base-nova style)
- **Map**: MapLibre GL JS via react-map-gl, with Protomaps basemap tiles served from R2
- **Validation**: Zod for data schemas
- **Route tree**: Auto-generated at `src/routeTree.gen.ts` — do not edit manually
- **Path aliases**: `@/*` maps to `./src/*`
- **Deployment**: Cloudflare Workers (`wrangler.jsonc`), R2 bucket for PMTiles

### Key directories

- `src/routes/` — File-based routes. `__root.tsx` is the root layout
  - `src/routes/tiles/$.ts` — Tile serving API route (PMTiles from R2)
  - `src/routes/train/$trainId.tsx` — Individual train detail page
- `src/components/` — App-level components (map, sidebar, train timeline, etc.)
- `src/components/ui/` — shadcn/ui primitives
- `src/hooks/` — Custom React hooks (e.g., `use-mobile.ts`)
- `src/server/` — Server-side logic: train data fetching, transformation, and Zod schemas
- `src/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- `public/viarail/` — Static JSON data for train routes (Canadian, Corridor, Ocean, etc.)

### shadcn/ui

UI components come from shadcn/ui (base-nova style). When adding or working with shadcn components, use the **shadcn MCP tools** (`mcp__shadcn__*`) to look up available components, view examples, and get the correct install commands rather than guessing.

### Theming

Theme colors are defined via CSS variables in `src/styles.css` with light and dark variants. The dark variant is activated by the `.dark` class on `<html>`.
