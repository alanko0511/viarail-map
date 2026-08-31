import { createServerFn } from "@tanstack/react-start"

import type { ConsistQuery, ConsistResponse } from "@/server/schemas/consist"
import {
  ConsistQuerySchema,
  ConsistResponseSchema,
} from "@/server/schemas/consist"

const TRAINCAR_API_URL = "https://traincar.info/api"

/** Consists change at most daily, and this is a volunteer-run service. */
const CACHE_TTL_MS = 30 * 60 * 1000

const TIMEOUT_MS = 8000

/**
 * Best-effort cache. Worker isolates are ephemeral, so this only spares
 * traincar.info the repeat lookups within one isolate's life — which is still
 * most of them, because the sidebar refetches every time you reselect a train.
 */
const cache = new Map<string, { at: number; value: ConsistResponse | null }>()

/**
 * The consist for one departure, or null when it cannot be determined.
 *
 * Never throws. traincar.info is one person's unofficial proxy with no SLA, and
 * an unavailable consist is a missing badge, not a broken sidebar. Failures are
 * cached alongside successes so a train the reservation system rejects (an
 * origin/destination pair that is not on the service, say) is not retried on
 * every render.
 */
export async function fetchConsist(
  query: ConsistQuery
): Promise<ConsistResponse | null> {
  const key = `${query.number}|${query.date}|${query.origin}|${query.destination}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value

  const value = await requestConsist(query)
  cache.set(key, { at: Date.now(), value })
  return value
}

async function requestConsist(
  query: ConsistQuery
): Promise<ConsistResponse | null> {
  const url = `${TRAINCAR_API_URL}?${new URLSearchParams(query)}`

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!response.ok) {
      console.warn(
        `traincar.info error for train ${query.number}: ${response.status} ${response.statusText}`
      )
      return null
    }

    const data = await response.json()
    return parseConsist(data, query.number)
  } catch (error) {
    console.warn(
      `traincar.info request failed for train ${query.number}:`,
      error
    )
    return null
  }
}

/**
 * Upstream reports both missing parameters and unbookable services with a 200
 * and an error body: `{"errors": ["Missing train number"]}` for the former,
 * `{"error": {"code": 7002, "message": "..."}}` for the latter. Neither is a
 * consist, so both fall through to null the same way a shape change would.
 */
export function parseConsist(
  data: unknown,
  number: string
): ConsistResponse | null {
  const result = ConsistResponseSchema.safeParse(data)
  if (result.success) return result.data

  if (typeof data === "object" && data !== null) {
    const body = data as { error?: unknown; errors?: unknown }
    if (body.error || body.errors) {
      console.warn(
        `traincar.info has no consist for train ${number}:`,
        JSON.stringify(body.error ?? body.errors)
      )
      return null
    }
  }

  console.warn(
    `Unparseable traincar.info payload for train ${number}:`,
    result.error.message
  )
  return null
}

/**
 * Called from the client because traincar.info sends no CORS headers, so the
 * browser cannot reach it directly. Mirrors `getFeeds` in gtfs-rt/feeds.ts.
 */
export const getConsist = createServerFn({ method: "GET" })
  .inputValidator(ConsistQuerySchema)
  .handler(({ data }) => fetchConsist(data))
