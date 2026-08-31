import { useEffect, useState } from "react"

import type { ConsistSummary } from "@/lib/consist"
import { consistQuery, summarizeConsist } from "@/lib/consist"
import type { TrainView } from "@/lib/view-model"
import { getConsist } from "@/server/consist"

export interface TrainConsist {
  summary: ConsistSummary | null
  loading: boolean
}

/**
 * The consist for one train, fetched on demand.
 *
 * Unlike the feeds, this is not part of the route loader: it is a third-party
 * lookup for whichever train happens to be selected, and it must never hold up
 * the map. A train with no consist simply resolves to `null`.
 */
export function useTrainConsist(train: TrainView | undefined): TrainConsist {
  const [summary, setSummary] = useState<ConsistSummary | null>(null)
  const [loading, setLoading] = useState(false)

  const query = train ? consistQuery(train) : null
  // The effect keys on the query's contents rather than its identity, which is
  // a fresh object on every render.
  const key = query
    ? `${query.number}|${query.date}|${query.origin}|${query.destination}`
    : null

  useEffect(() => {
    if (!query) {
      setSummary(null)
      setLoading(false)
      return
    }

    let ignore = false
    setSummary(null)
    setLoading(true)

    getConsist({ data: query })
      .then((response) => {
        if (ignore) return
        setSummary(response ? summarizeConsist(response) : null)
      })
      .catch(() => {
        if (!ignore) setSummary(null)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    // Switching trains mid-flight must not let the older response land last.
    return () => {
      ignore = true
    }
  }, [key])

  return { summary, loading }
}
