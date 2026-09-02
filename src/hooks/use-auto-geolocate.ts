import { useEffect, useRef } from "react"
import type { GeolocateControlInstance } from "react-map-gl/maplibre"

// Rough bounding box covering Canada
const CANADA_BOUNDS = {
  minLat: 41.7,
  maxLat: 83.1,
  minLon: -141.0,
  maxLon: -52.6,
}

function isWithinCanada(lat: number, lon: number) {
  return (
    lat >= CANADA_BOUNDS.minLat &&
    lat <= CANADA_BOUNDS.maxLat &&
    lon >= CANADA_BOUNDS.minLon &&
    lon <= CANADA_BOUNDS.maxLon
  )
}

export function useAutoGeolocate({
  enabled,
  skip,
  geolocateControlRef,
}: {
  /** Attempt auto-centering once this becomes true (map has loaded) */
  enabled: boolean
  /** Consume the one attempt without centering (e.g. a train deep link is active) */
  skip?: boolean
  geolocateControlRef: React.RefObject<GeolocateControlInstance | null>
}) {
  const attemptedRef = useRef(false)
  const skipRef = useRef(skip)
  skipRef.current = skip

  useEffect(() => {
    if (!enabled || attemptedRef.current) return
    attemptedRef.current = true
    if (skipRef.current) return
    if (!("geolocation" in navigator) || !("permissions" in navigator)) return

    let cancelled = false

    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        if (cancelled || skipRef.current || status.state !== "granted") return
        // Permission already granted, so this never prompts
        navigator.geolocation.getCurrentPosition(
          (position) => {
            // A train may have been selected while the lookup was in flight;
            // its fly-to owns the view now.
            if (cancelled || skipRef.current) return
            const { latitude, longitude } = position.coords
            if (isWithinCanada(latitude, longitude)) {
              geolocateControlRef.current?.trigger()
            }
          },
          () => {
            // Silent failure — keep the default view
          },
          { maximumAge: 60_000, timeout: 10_000 }
        )
      })
      .catch(() => {
        // Permissions API can't inspect geolocation — stay silent
      })

    return () => {
      cancelled = true
    }
  }, [enabled, geolocateControlRef])
}
