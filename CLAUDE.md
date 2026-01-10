# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VIA Rail Live Train Tracker - A real-time train tracking web app displaying live VIA Rail train locations on a Mapbox map with journey timelines. Uses data from VIA Rail's `tsimobile.viarail.ca` API.

## Development Commands

```bash
bun run dev        # Start Vite dev server
bun run build      # TypeScript check + Vite build
bun run lint       # ESLint check
bun run preview    # Build and preview production
bun run deploy     # Build and deploy to Cloudflare
```

## Architecture

### Frontend (React + Mantine)

- **Entry point**: `src/main.tsx` → `App.tsx` → `AppRouter.tsx`
- **Main page**: `src/routes/IndexPage.tsx` - Contains map, TrainMarker, and ViaRailRoutes components
- **Timeline panel**: `src/components/TimelineDetails.tsx` - Station timeline for selected train
- **Data fetching**: `src/hooks/useViaRailData.ts` - TanStack Query with 10s refetch interval
- **API client**: `src/services/api.ts` - Hono RPC client with type inference from worker

### Backend (Cloudflare Worker)

- **Server**: `worker/index.ts` - Hono server with single `/trainData` endpoint
- **Data service**: `worker/services/viaRailData.ts` - Fetches from VIA Rail API with Zod validation

### Shared

- **Utilities**: `shared/utils.ts` - Station status helpers (hasDepartedFromStation, hasArrivedAtStation, isStationCompleted)

### Map Routes

GeoJSON route files in `public/viarail/` - 12 route files (Canadian, Corridor, Ocean, etc.)

## Tech Stack

- **Frontend**: React 19, Mantine 8, react-map-gl + Mapbox GL, TanStack React Query, Wouter
- **Backend**: Cloudflare Worker, Hono, Zod
- **Build**: Vite, SWC, TypeScript 5.8

## TypeScript Conventions

1. **Use arrow functions** for all functions (except class methods)
2. **Use explicit `type` imports**: `import type { User } from "./types"`
3. **Use `type` over `interface`** for type definitions
4. **Inline props types** in components unless shared across files

## Environment Variables

Required in `.env.development` / `.env.production`:

- `VITE_MAPBOX_ACCESS_TOKEN`

## Key Patterns

- URL routing with optional train ID: `/:trainId?`
- Color-coded delays: green (<5m), orange (5-15m), red (>15m)
- Train markers rotate arrow based on `train.direction`
