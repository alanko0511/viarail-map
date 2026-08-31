import { createServerFn } from "@tanstack/react-start"

import type { ConsistQuery, ConsistResponse } from "@/server/schemas/consist"
import {
  ConsistQuerySchema,
  ConsistResponseSchema,
} from "@/server/schemas/consist"

const TRAINCAR_API_URL = "https://traincar.info/api"

/** Consists change at most daily, and this is a volunteer-run service. */
const CACHE_TTL_SECONDS = 30 * 60

const TIMEOUT_MS = 8000

/**
 * The Workers cache, when we are running on Workers.
 *
 * Absent under Vitest and anywhere else outside workerd, where every lookup
 * simply misses and goes upstream.
 */
function workerCache(): Cache | undefined {
  // `caches.default` is a workerd extension. The DOM lib this project compiles
  // against wins over the generated worker types for CacheStorage, so the
  // property is spelled out here rather than widening `lib` for one call.
  const storage = globalThis.caches as
    | (CacheStorage & { default?: Cache })
    | undefined
  return storage?.default
}

/**
 * The consist for one departure, or null when it cannot be determined.
 *
 * Never throws. traincar.info is one person's unofficial proxy with no SLA, and
 * an unavailable consist is a missing badge, not a broken sidebar. Failures are
 * cached alongside successes so a train the reservation system rejects (an
 * origin/destination pair that is not on the service, say) is not retried on
 * every render.
 *
 * Caching goes through the Workers cache rather than a module-level Map: the
 * cache is bounded and evicted by the runtime, so an unbounded set of distinct
 * queries cannot grow the isolate's heap. It is per data centre and not
 * read-through, which is fine here — the point is to spare traincar.info the
 * repeat lookups the sidebar generates, not to guarantee a hit.
 */
export async function fetchConsist(
  query: ConsistQuery
): Promise<ConsistResponse | null> {
  const url = `${TRAINCAR_API_URL}?${new URLSearchParams(query)}`
  const cache = workerCache()

  if (cache) {
    try {
      const hit = await cache.match(url)
      // `null` is a real cached answer (upstream has no consist for this
      // train), so the parsed body is returned as-is rather than being
      // treated as a miss.
      if (hit) return (await hit.json()) as ConsistResponse | null
    } catch (error) {
      console.warn("Consist cache read failed:", error)
    }
  }

  const value = await requestConsist(url, query.number)

  if (cache) {
    try {
      await cache.put(
        url,
        new Response(JSON.stringify(value), {
          headers: {
            "content-type": "application/json",
            "cache-control": `public, max-age=${CACHE_TTL_SECONDS}`,
          },
        })
      )
    } catch (error) {
      console.warn("Consist cache write failed:", error)
    }
  }

  return value
}

async function requestConsist(
  url: string,
  number: string
): Promise<ConsistResponse | null> {
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
        `traincar.info error for train ${number}: ${response.status} ${response.statusText}`
      )
      return null
    }

    const data = await response.json()
    return parseConsist(data, number)
  } catch (error) {
    console.warn(`traincar.info request failed for train ${number}:`, error)
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
