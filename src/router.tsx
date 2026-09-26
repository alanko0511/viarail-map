import { QueryClient } from "@tanstack/react-query"
import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"

import { routeTree } from "./routeTree.gen"

export function getRouter() {
  // Start builds a router per SSR request, so the client lives here rather than
  // at module scope, where one request's cache would leak into another's HTML.
  const queryClient = new QueryClient()

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },

    scrollRestoration: true,
    defaultPreload: "intent",
    // Query decides whether a preload needs fresh data, not the router's cache.
    defaultPreloadStaleTime: 0,
  })

  // Supplies the QueryClientProvider and handles SSR dehydration/hydration.
  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
