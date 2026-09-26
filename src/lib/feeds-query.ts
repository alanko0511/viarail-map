import { queryOptions } from "@tanstack/react-query"

import type { CanonicalFeeds } from "@/lib/view-model"
import { getFeeds } from "@/server/gtfs-rt/feeds"

export const EMPTY_FEEDS: CanonicalFeeds = {
  tripUpdates: {},
  vehiclePositions: {},
  alerts: {},
}

/**
 * The live GTFS-Realtime feeds.
 *
 * Upstream refreshes every 15s, so polling faster only wastes requests. Query
 * pauses the interval while the tab is hidden and refetches as soon as it is
 * visible again. A failed poll keeps the previous data rather than clearing
 * every train off the map until the next one succeeds.
 */
export const feedsQuery = queryOptions({
  queryKey: ["feeds"],
  queryFn: () => getFeeds(),
  refetchInterval: 15_000,
  // Long enough that mounting right after the loader's fetch, or hovering a
  // train link, doesn't fetch again; short enough that returning to the tab
  // almost always does.
  staleTime: 5_000,
})
