import { createServerFn } from "@tanstack/react-start"
import { getRequestHeader } from "@tanstack/react-start/server"

export const getGeolocation = createServerFn({ method: "GET" }).handler(
  async () => {
    const ip =
      getRequestHeader("cf-connecting-ip") ||
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim()

    if (!ip) return null

    try {
      const res = await fetch(
        `http://ip-api.com/json/${ip}?fields=status,lat,lon,countryCode`,
        { signal: AbortSignal.timeout(1000) },
      )
      if (!res.ok) return null

      const data: {
        status: string
        lat: number
        lon: number
        countryCode: string
      } = await res.json()
      if (data.status !== "success" || data.countryCode !== "CA") return null

      return { lat: data.lat, lon: data.lon }
    } catch {
      return null
    }
  },
)
