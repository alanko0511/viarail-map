import { createServerFn } from "@tanstack/react-start"

import type { CanonicalFeeds } from "@/lib/view-model"
import { toCanonicalJson } from "@/server/gtfs-rt/build-feed"
import { buildLiveFeeds } from "@/server/gtfs-rt/serve"

/**
 * The same three GTFS-Realtime messages the public endpoints serve, in their
 * canonical JSON form. Called directly rather than over HTTP: a Worker
 * fetching its own route would just be a subrequest for no reason.
 */
export const getFeeds = createServerFn({ method: "GET" }).handler(
  async (): Promise<CanonicalFeeds> => {
    const feeds = await buildLiveFeeds()
    return {
      tripUpdates: toCanonicalJson(feeds.tripUpdates),
      vehiclePositions: toCanonicalJson(feeds.vehiclePositions),
      alerts: toCanonicalJson(feeds.alerts),
    }
  }
)
