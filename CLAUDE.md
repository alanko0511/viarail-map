# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive map visualization of VIA Rail Canada's train routes. Built with TanStack Start (React 19 SSR framework), Vite, and Tailwind CSS v4.

## Commands

```bash
bun --bun run dev       # Dev server on port 3000
bun --bun run build     # Production build
bun --bun run preview   # Preview production build
bun --bun run test      # Run Vitest tests
```

Package manager is **Bun**.

## Architecture

- **Framework**: TanStack Start with file-based routing (`src/routes/`)
- **Styling**: Tailwind CSS v4 + shadcn/ui components (base-nova style)
- **Route tree**: Auto-generated at `src/routeTree.gen.ts` — do not edit manually
- **Path aliases**: `#/*` and `@/*` both map to `./src/*`

### Key directories

- `src/routes/` — File-based routes. `__root.tsx` is the root layout (Header, Footer, theme init script)
- `src/components/ui/` — shadcn/ui primitives
- `src/components/` — App-level components
- `src/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- `public/viarail/` — Static JSON data for train routes (Canadian, Corridor, Ocean, etc.)

### shadcn/ui

UI components come from shadcn/ui (base-nova style). When adding or working with shadcn components, use the **shadcn MCP tools** (`mcp__shadcn__*`) to look up available components, view examples, and get the correct install commands rather than guessing.

### Theming

Light/dark/auto theme support via CSS variables in `src/styles.css`. Theme is persisted in localStorage and an inline script in `__root.tsx` prevents flash on load. The `ThemeToggle` component cycles through modes.
