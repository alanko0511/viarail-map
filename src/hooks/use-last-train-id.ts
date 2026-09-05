import * as React from "react"

const STORAGE_KEY = "viarail-map:last-train-id"

function readStoredTrainId(): string | undefined {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? undefined
  } catch {
    return undefined
  }
}

/**
 * Remembers the train the user last had open, so an empty sidebar can offer a
 * way back to it. Writes on every selection; reads once on mount.
 */
export function useLastTrainId(activeTrainId: string | undefined) {
  const [lastTrainId, setLastTrainId] = React.useState<string | undefined>(
    undefined,
  )

  React.useEffect(() => {
    setLastTrainId(readStoredTrainId())
  }, [])

  React.useEffect(() => {
    if (!activeTrainId) return
    setLastTrainId(activeTrainId)
    try {
      window.localStorage.setItem(STORAGE_KEY, activeTrainId)
    } catch {
      // Private browsing or a full quota; remembering is best-effort.
    }
  }, [activeTrainId])

  return lastTrainId
}
