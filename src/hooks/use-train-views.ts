import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { EMPTY_FEEDS, feedsQuery } from "@/lib/feeds-query"
import type { TrainView } from "@/lib/view-model"
import { toTrainViews } from "@/lib/view-model"

/** Every train currently in the feed, keyed by its tracker id. */
export function useTrainViews(): Map<string, TrainView> {
  // Empty only until the first successful fetch; after that a failed poll
  // leaves the previous data in place.
  const { data: feeds = EMPTY_FEEDS } = useQuery(feedsQuery)

  return useMemo(() => {
    const views = toTrainViews(feeds)
    views.sort((a, b) => Number(a.number) - Number(b.number))
    return new Map(views.map((view) => [view.key, view]))
  }, [feeds])
}
