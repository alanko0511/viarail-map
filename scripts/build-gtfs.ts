/**
 * Builds runtime artifacts from VIA Rail's published GTFS schedule feed.
 *
 * Reads the committed zip at data/gtfs/viarail.zip and emits:
 *   - src/data/gtfs/*.json   typed lookup tables used by the server and client
 *   - public/gtfs/*          the raw feed, redistributed unmodified
 *   - public/gtfs/shapes.geojson  deduplicated route geometry for the map
 *
 * Run with: bun run gtfs:build
 */
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { unzipSync } from "fflate"

import { parseCsv, parseGtfsTime } from "./gtfs/csv"

const ROOT = join(new URL("..", import.meta.url).pathname)
const ZIP_PATH = join(ROOT, "data/gtfs/viarail.zip")
const DATA_OUT = join(ROOT, "src/data/gtfs")
const PUBLIC_OUT = join(ROOT, "public/gtfs")

/** Coordinate precision for map geometry. 4dp is ~11m, plenty at rail scale. */
const SHAPE_PRECISION = 4

/** Fail the build if the feed expires within this many days. */
const MIN_VALIDITY_DAYS = 30

function fail(message: string): never {
  console.error(`\n  build-gtfs: ${message}\n`)
  process.exit(1)
}

// ---------------------------------------------------------------- read input

const zipBytes = readFileSync(ZIP_PATH)
const sourceSha256 = createHash("sha256").update(zipBytes).digest("hex")

/**
 * The date this feed was retrieved, in YYYY-MM-DD.
 *
 * Reuses the committed value while the zip's hash is unchanged, so rebuilding
 * unchanged data is reproducible. A new zip means a new hash, and today is when
 * it arrived. `/gtfs` shows this as "Retrieved" and CI fails once it falls too
 * far behind, so it has to track the data rather than the clock. Read here,
 * before the output directories are wiped further down.
 */
const retrievedAt = (() => {
  const today = new Date().toISOString().slice(0, 10)
  try {
    const previous = JSON.parse(
      readFileSync(join(DATA_OUT, "feed-info.json"), "utf8")
    ) as { builtAt?: string; sourceSha256?: string }
    return previous.sourceSha256 === sourceSha256 && previous.builtAt
      ? previous.builtAt
      : today
  } catch {
    return today
  }
})()
const entries = unzipSync(new Uint8Array(zipBytes))
const decoder = new TextDecoder()

function table(name: string): Array<Record<string, string>> {
  const bytes = entries[name]
  if (!bytes) fail(`${name} is missing from the feed`)
  return parseCsv(decoder.decode(bytes))
}

const rawStops = table("stops.txt")
const rawRoutes = table("routes.txt")
const rawTrips = table("trips.txt")
const rawStopTimes = table("stop_times.txt")
const rawCalendar = table("calendar.txt")
const rawCalendarDates = table("calendar_dates.txt")
const rawShapes = table("shapes.txt")
const rawFeedInfo = table("feed_info.txt")

// -------------------------------------------------------------- stop_times

type StopTimeRow = [
  sequence: number,
  stopId: string,
  arrival: number | null,
  departure: number | null,
]

const stopTimes: Record<string, Array<StopTimeRow>> = {}
for (const row of rawStopTimes) {
  ;(stopTimes[row.trip_id] ??= []).push([
    Number(row.stop_sequence),
    row.stop_id,
    parseGtfsTime(row.arrival_time),
    parseGtfsTime(row.departure_time),
  ])
}
for (const rows of Object.values(stopTimes)) {
  rows.sort((a, b) => a[0] - b[0])
}

/** How many distinct trips call at each stop — drives map label prominence. */
const tripsPerStop = new Map<string, number>()
for (const rows of Object.values(stopTimes)) {
  for (const stopId of new Set(rows.map((row) => row[1]))) {
    tripsPerStop.set(stopId, (tripsPerStop.get(stopId) ?? 0) + 1)
  }
}

// ------------------------------------------------------------------- stops

const stops = rawStops.map((row) => ({
  id: row.stop_id,
  code: row.stop_code,
  name: row.stop_name,
  lon: Number(row.stop_lon),
  lat: Number(row.stop_lat),
  tz: row.stop_timezone,
  rank: tripsPerStop.get(row.stop_id) ?? 0,
}))

const seenCodes = new Set<string>()
for (const stop of stops) {
  if (!stop.code) fail(`stop ${stop.id} (${stop.name}) has no stop_code`)
  if (seenCodes.has(stop.code)) fail(`stop_code ${stop.code} is not unique`)
  seenCodes.add(stop.code)
}

// ------------------------------------------------------------------ shapes

const shapePoints = new Map<string, Array<[number, number, number]>>()
for (const row of rawShapes) {
  if (!row.shape_id) continue
  const list = shapePoints.get(row.shape_id) ?? []
  list.push([
    Number(Number(row.shape_pt_lon).toFixed(SHAPE_PRECISION)),
    Number(Number(row.shape_pt_lat).toFixed(SHAPE_PRECISION)),
    Number(row.shape_pt_sequence),
  ])
  shapePoints.set(row.shape_id, list)
}

/**
 * VIA publishes one shape per trip, but the 83 shapes collapse to 19 distinct
 * polylines: each direction of a route is the same line reversed, and every
 * Ottawa-Toronto trip shares one geometry. Serving all 83 would triple the
 * payload for no visual gain, so they are grouped by geometry.
 */
const geometryIdByShapeId = new Map<string, string>()
const geometries = new Map<string, Array<[number, number]>>()

for (const [shapeId, points] of shapePoints) {
  points.sort((a, b) => a[2] - b[2])
  const coordinates = points.map(([lon, lat]) => [lon, lat] as [number, number])
  const forward = JSON.stringify(coordinates)
  const backward = JSON.stringify([...coordinates].reverse())
  const key = forward < backward ? forward : backward

  const existing = [...geometries.entries()].find(([, coords]) => {
    const f = JSON.stringify(coords)
    const b = JSON.stringify([...coords].reverse())
    return (f < b ? f : b) === key
  })

  if (existing) {
    geometryIdByShapeId.set(shapeId, existing[0])
  } else {
    geometries.set(shapeId, coordinates)
    geometryIdByShapeId.set(shapeId, shapeId)
  }
}

if (geometries.size !== 19) {
  fail(
    `expected 19 distinct shape geometries, found ${geometries.size} — VIA may have restructured the feed`
  )
}

// ------------------------------------------------------------ trips, routes

const trips = rawTrips.map((row) => {
  const shapeId = row.shape_id || null
  if (shapeId && !geometryIdByShapeId.has(shapeId)) {
    fail(`trip ${row.trip_id} references unknown shape_id ${shapeId}`)
  }
  return {
    id: row.trip_id,
    routeId: row.route_id,
    serviceId: row.service_id,
    shapeId,
    geometryId: shapeId ? geometryIdByShapeId.get(shapeId)! : null,
    shortName: row.trip_short_name,
    headsign: row.trip_headsign,
    directionId: row.direction_id === "" ? null : Number(row.direction_id),
  }
})

const routes = rawRoutes.map((row) => ({
  id: row.route_id,
  longName: row.route_long_name,
  type: Number(row.route_type),
}))

// ---------------------------------------------------------------- calendar

const calendar: Record<
  string,
  { start: string; end: string; days: Array<boolean> }
> = {}
for (const row of rawCalendar) {
  calendar[row.service_id] = {
    start: row.start_date,
    end: row.end_date,
    // Index 0 is Sunday, matching JavaScript's Date#getDay.
    days: [
      row.sunday === "1",
      row.monday === "1",
      row.tuesday === "1",
      row.wednesday === "1",
      row.thursday === "1",
      row.friday === "1",
      row.saturday === "1",
    ],
  }
}

const calendarDates: Record<
  string,
  Array<{ date: string; added: boolean }>
> = {}
for (const row of rawCalendarDates) {
  ;(calendarDates[row.service_id] ??= []).push({
    date: row.date,
    added: row.exception_type === "1",
  })
}

// -------------------------------------------------------------- trip index

/**
 * Maps a public train number to candidate trips. Indexed on the raw
 * trip_short_name and, for joint services like the Maple Leaf ("97-64"), on
 * each hyphen component too.
 */
const tripIndex: Record<string, Array<string>> = {}
for (const trip of trips) {
  if (!trip.shortName) continue
  const keys = new Set([trip.shortName, ...trip.shortName.split("-")])
  for (const key of keys) {
    ;(tripIndex[key] ??= []).push(trip.id)
  }
}

// -------------------------------------------------------------- feed_info

const feedInfo = rawFeedInfo[0]
if (!feedInfo) fail("feed_info.txt is empty")

const endDate = feedInfo.feed_end_date
const endsAt = Date.UTC(
  Number(endDate.slice(0, 4)),
  Number(endDate.slice(4, 6)) - 1,
  Number(endDate.slice(6, 8))
)
const daysLeft = Math.floor((endsAt - Date.now()) / 86_400_000)
if (daysLeft < MIN_VALIDITY_DAYS) {
  fail(
    `feed expires in ${daysLeft} days (${endDate}) — download a newer feed from https://www.viarail.ca/en/developer-resources`
  )
}

// ------------------------------------------------------------------- write

rmSync(DATA_OUT, { recursive: true, force: true })
mkdirSync(DATA_OUT, { recursive: true })
rmSync(PUBLIC_OUT, { recursive: true, force: true })
mkdirSync(PUBLIC_OUT, { recursive: true })

const json = (name: string, value: unknown) =>
  writeFileSync(join(DATA_OUT, name), JSON.stringify(value))

json("stops.json", stops)
json("routes.json", routes)
json("trips.json", trips)
json("stop-times.json", stopTimes)
json("calendar.json", { services: calendar, exceptions: calendarDates })
json("trip-index.json", tripIndex)
// `builtAt` is when this zip was retrieved, not when the script last ran, so it
// survives a rebuild of an unchanged feed. Stamping the clock every run made
// the output differ from the committed copy on any day after the last refresh,
// which failed CI's drift check without the data having changed at all.
json("feed-info.json", {
  publisher: feedInfo.feed_publisher_name,
  url: feedInfo.feed_publisher_url,
  lang: feedInfo.feed_lang,
  start: feedInfo.feed_start_date,
  end: feedInfo.feed_end_date,
  builtAt: retrievedAt,
  sourceSha256,
})

// Redistribute the feed unmodified, plus the deduplicated map geometry.
writeFileSync(join(PUBLIC_OUT, "viarail.zip"), zipBytes)
for (const [name, bytes] of Object.entries(entries)) {
  if (name.endsWith(".txt")) writeFileSync(join(PUBLIC_OUT, name), bytes)
}

const routeIdByGeometry = new Map<string, string>()
for (const trip of trips) {
  if (trip.geometryId) routeIdByGeometry.set(trip.geometryId, trip.routeId)
}

writeFileSync(
  join(PUBLIC_OUT, "shapes.geojson"),
  JSON.stringify({
    type: "FeatureCollection",
    features: [...geometries].map(([geometryId, coordinates]) => ({
      type: "Feature",
      id: geometryId,
      properties: {
        geometryId,
        routeId: routeIdByGeometry.get(geometryId) ?? null,
      },
      geometry: { type: "LineString", coordinates },
    })),
  })
)

console.log(
  `build-gtfs: ${stops.length} stops, ${routes.length} routes, ${trips.length} trips, ` +
    `${geometries.size} shapes (from ${shapePoints.size}), valid to ${endDate} (${daysLeft} days)`
)
