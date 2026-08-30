// Typed access to the GTFS schedule artifacts generated from
// data/gtfs/viarail.zip by scripts/build-gtfs.ts.
// The .json files under ./gtfs/ are build output — edit the script, not them.
import calendarJson from "./gtfs/calendar.json"
import feedInfoJson from "./gtfs/feed-info.json"
import routesJson from "./gtfs/routes.json"
import stopTimesJson from "./gtfs/stop-times.json"
import stopsJson from "./gtfs/stops.json"
import tripIndexJson from "./gtfs/trip-index.json"
import tripsJson from "./gtfs/trips.json"

export interface GtfsStop {
  id: string
  /** The 4-letter VIA station code, which joins to the live tracker feed. */
  code: string
  name: string
  lon: number
  lat: number
  tz: string
  /** Number of distinct trips calling here; drives map label prominence. */
  rank: number
}

export interface GtfsRoute {
  id: string
  longName: string
  /** GTFS route_type: 2 is rail, 3 is the Air Connect bus. */
  type: number
}

export interface GtfsTrip {
  id: string
  routeId: string
  serviceId: string
  shapeId: string | null
  /** Representative shape id after deduplication; keys into shapes.geojson. */
  geometryId: string | null
  /** The public VIA train number. Not unique — train 26 has two trips. */
  shortName: string
  headsign: string
  directionId: number | null
}

/**
 * `[stop_sequence, stop_id, arrival, departure]`. Times are seconds from
 * midnight and may exceed 86400 on trips running past midnight.
 */
export type GtfsStopTime = [number, string, number | null, number | null]

export interface GtfsService {
  start: string
  end: string
  /** Indexed by Date#getDay: 0 is Sunday. */
  days: Array<boolean>
}

export const stops = stopsJson as Array<GtfsStop>
export const routes = routesJson as Array<GtfsRoute>
export const trips = tripsJson as Array<GtfsTrip>
export const stopTimes = stopTimesJson as unknown as Record<
  string,
  Array<GtfsStopTime>
>
export const tripIndex = tripIndexJson as Record<string, Array<string>>
export const calendar = calendarJson as {
  services: Record<string, GtfsService>
  exceptions: Record<string, Array<{ date: string; added: boolean }>>
}
export const feedInfo = feedInfoJson

export const stopByCode = new Map(stops.map((stop) => [stop.code, stop]))
export const stopById = new Map(stops.map((stop) => [stop.id, stop]))
export const tripById = new Map(trips.map((trip) => [trip.id, trip]))
export const routeById = new Map(routes.map((route) => [route.id, route]))

export const staticGtfs = {
  stops,
  routes,
  trips,
  stopTimes,
  tripIndex,
  calendar,
  feedInfo,
  stopByCode,
  stopById,
  tripById,
  routeById,
}

export type StaticGtfs = typeof staticGtfs
