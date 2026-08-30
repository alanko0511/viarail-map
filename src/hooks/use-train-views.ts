import { useMemo } from "react"

import type { TrainView } from "@/lib/view-model"
import { toTrainViews } from "@/lib/view-model"
import { Route as MapRoute } from "@/routes/_map"

/** Every train currently in the feed, keyed by its tracker id. */
export function useTrainViews(): Map<string, TrainView> {
  const { feeds } = MapRoute.useLoaderData()

  return useMemo(() => {
    const views = toTrainViews(feeds)
    views.sort((a, b) => Number(a.number) - Number(b.number))
    return new Map(views.map((view) => [view.key, view]))
  }, [feeds])
}
