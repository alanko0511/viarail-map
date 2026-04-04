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
bun --bun run lint      # ESLint (TanStack config)
bun --bun run format    # Prettier (with tailwindcss plugin)
bun --bun run typecheck # tsc --noEmit
```

Package manager is **Bun**.

## Architecture

- **Framework**: TanStack Start with file-based routing (`src/routes/`)
- **Styling**: Tailwind CSS v4 + shadcn/ui components (base-nova style)
- **Route tree**: Auto-generated at `src/routeTree.gen.ts` — do not edit manually
- **Path aliases**: `@/*` maps to `./src/*`

### Key directories

- `src/routes/` — File-based routes. `__root.tsx` is the root layout
- `src/components/ui/` — shadcn/ui primitives
- `src/components/` — App-level components
- `src/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- `public/viarail/` — Static JSON data for train routes (Canadian, Corridor, Ocean, etc.)

### shadcn/ui

UI components come from shadcn/ui (base-nova style). When adding or working with shadcn components, use the **shadcn MCP tools** (`mcp__shadcn__*`) to look up available components, view examples, and get the correct install commands rather than guessing.

### Theming

Theme colors are defined via CSS variables in `src/styles.css` with light and dark variants. The dark variant is activated by the `.dark` class on `<html>`.
