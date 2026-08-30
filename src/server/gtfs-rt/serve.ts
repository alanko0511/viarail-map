import type { transit_realtime as rt } from "gtfs-realtime-bindings"
import { transit_realtime } from "gtfs-realtime-bindings"
import { Writer } from "protobufjs/minimal"

import { buildFeeds, toCanonicalJson } from "@/server/gtfs-rt/build-feed"
import { fetchAllTrainData } from "@/server/trains"

export const FEED_NAMES = [
  "vehicle-positions",
  "trip-updates",
  "alerts",
] as const
export type FeedName = (typeof FEED_NAMES)[number]

export const FEED_FORMATS = ["pb", "json"] as const
export type FeedFormat = (typeof FEED_FORMATS)[number]

export function parseFeedPath(
  path: string
): { name: FeedName; format: FeedFormat } | null {
  const dot = path.lastIndexOf(".")
  if (dot === -1) return null

  const name = path.slice(0, dot)
  const format = path.slice(dot + 1)

  if (!FEED_NAMES.includes(name as FeedName)) return null
  if (!FEED_FORMATS.includes(format as FeedFormat)) return null

  return { name: name as FeedName, format: format as FeedFormat }
}

export async function buildLiveFeeds() {
  return buildFeeds(await fetchAllTrainData(), new Date())
}

function select(
  feeds: Awaited<ReturnType<typeof buildLiveFeeds>>,
  name: FeedName
): rt.FeedMessage {
  switch (name) {
    case "vehicle-positions":
      return feeds.vehiclePositions
    case "trip-updates":
      return feeds.tripUpdates
    case "alerts":
      return feeds.alerts
  }
}

export async function serveFeed(path: string): Promise<Response> {
  const requested = parseFeedPath(path)
  if (!requested) {
    return new Response("Not found", { status: 404 })
  }

  const feed = select(await buildLiveFeeds(), requested.name)

  const headers: Record<string, string> = {
    "access-control-allow-origin": "*",
    "cache-control": "public, max-age=10, stale-while-revalidate=20",
    vary: "Accept-Encoding",
  }

  if (requested.format === "json") {
    return new Response(JSON.stringify(toCanonicalJson(feed)), {
      headers: { ...headers, "content-type": "application/json" },
    })
  }

  // protobufjs defaults to a Buffer-backed writer, whose utf8Write miscounts
  // multi-byte strings on the Workers runtime and throws on the bilingual
  // alert text. The plain Uint8Array writer produces identical bytes.
  const bytes = transit_realtime.FeedMessage.encode(feed, new Writer()).finish()
  return new Response(bytes as unknown as BodyInit, {
    headers: { ...headers, "content-type": "application/x-protobuf" },
  })
}
