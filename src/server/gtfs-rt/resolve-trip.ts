import type { GtfsTrip } from "@/data/gtfs"
import { calendar, tripById, tripIndex } from "@/data/gtfs"
import type { Train } from "@/server/schemas/train"

export interface TripMatch {
  tripId: string
  routeId: string
}

/** Extracts the train number from a feed key like `"1 (08-30)"`. */
export function trainNumber(feedKey: string): string {
  const space = feedKey.indexOf(" ")
  return space === -1 ? feedKey : feedKey.slice(0, space)
}

/** `"2026-09-04"` -> `"20260904"`, the GTFS date form. */
function toGtfsDate(instance: string): string {
  return instance.replaceAll("-", "")
}

/** Whether a trip's service runs on the given service date. */
function runsOn(trip: GtfsTrip, instance: string): boolean {
  const service = calendar.services[trip.serviceId]
  if (!service) return false

  const date = toGtfsDate(instance)
  const exception = calendar.exceptions[trip.serviceId]?.find(
    (entry) => entry.date === date
  )
  if (exception) return exception.added

  if (date < service.start || date > service.end) return false
  return service.days[new Date(`${instance}T00:00:00Z`).getUTCDay()] ?? false
}

export function resolveTrip(feedKey: string, train: Train): TripMatch | null {
  const number = trainNumber(feedKey)
  const candidates = (tripIndex[number] ?? [])
    .map((id) => tripById.get(id))
    .filter((trip) => trip !== undefined)
  if (!candidates.length) return null

  // A train number that names a trip outright beats one that only appears as a
  // component of a joint service: train 63 is the Corridor run, not the half of
  // the Maple Leaf that shares the number.
  const exact = candidates.filter((trip) => trip.shortName === number)
  const preferred = exact.length ? exact : candidates

  // Train 26 runs as two trips whose calendars are disjoint (one Friday-only,
  // one every other day), so the service date picks the right one.
  const active = preferred.filter((trip) => runsOn(trip, train.instance))
  const trip = (active.length ? active : preferred)[0]

  return { tripId: trip.id, routeId: trip.routeId }
}
