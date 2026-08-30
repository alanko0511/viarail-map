import { fromZonedTime } from "date-fns-tz"

import type { GtfsStopTime } from "@/data/gtfs"
import { routeById, stopById, stopTimes, tripById } from "@/data/gtfs"

/** VIA's agency_timezone. GTFS stop_times are stored in it, whatever the stop's
 * own timezone: the Canadian's 15:00 departure from Vancouver is written
 * 18:00:00 because that is the hour in Toronto. */
const AGENCY_TIMEZONE = "America/Toronto"

/** A stop's dwell is only worth showing when the train actually waits. Upstream
 * pads pass-through stops with a departure a second or two after arrival. */
const DWELL_THRESHOLD_SECONDS = 7 * 60

export type StopStatus = "left" | "arrived" | "coming"

export interface StopTimeView {
  scheduled: Date
  predicted: Date | null
}

export interface StopView {
  stopId: string
  code: string
  name: string
  timezone: string
  status: StopStatus
  arrival: StopTimeView | null
  departure: StopTimeView | null
  delayMinutes: number | null
  cancelled: boolean
  showDwell: boolean
}

export interface PositionView {
  lat: number
  lng: number
  bearing: number | null
  speedKmh: number
  at: Date
}

export interface AlertView {
  header: string
  description: string
  url: string | null
}

export interface TrainView {
  key: string
  number: string
  tripId: string | null
  routeLongName: string
  headsign: string
  startDate: string
  position: PositionView | null
  stops: Array<StopView>
  alerts: Array<AlertView>
  /** True when the tracker published fewer stops than the trip actually has. */
  stopsAreTruncated: boolean
}

/**
 * Resolves a GTFS time to a real instant.
 *
 * GTFS counts seconds from noon minus twelve hours on the service day, which is
 * midnight except when the clocks change. Times past 86400 belong to the next
 * calendar day and are meant to run over, so no wrapping happens here.
 */
function serviceTime(startDate: string, seconds: number): Date {
  const day = `${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)}`
  const noon = fromZonedTime(`${day}T12:00:00`, AGENCY_TIMEZONE)
  return new Date(noon.getTime() - 12 * 3600 * 1000 + seconds * 1000)
}

interface CanonicalFeed {
  entity?: Array<Record<string, any>>
}

export interface CanonicalFeeds {
  tripUpdates: CanonicalFeed
  vehiclePositions: CanonicalFeed
  alerts: CanonicalFeed
}

const KMH_PER_MS = 3.6

/**
 * Pairs a scheduled time with its prediction. The schedule always survives:
 * a stop the realtime feed says nothing about still has a timetable.
 *
 * The published timestamp wins where there is one, because the delay is
 * rounded to whole minutes and rebuilding the time from it drifts by up to a
 * minute. Where the feed withheld the timestamp as untrustworthy, the delay is
 * all there is.
 */
function predicted(
  scheduled: Date,
  event: Record<string, any> | undefined
): StopTimeView {
  if (event?.time != null) {
    return { scheduled, predicted: new Date(Number(event.time) * 1000) }
  }

  const delay = event?.delay
  return {
    scheduled,
    predicted:
      typeof delay === "number"
        ? new Date(scheduled.getTime() + delay * 1000)
        : null,
  }
}

function toStopView(
  update: Record<string, any>,
  row: GtfsStopTime,
  startDate: string,
  status: StopStatus,
  isOrigin: boolean,
  isDestination: boolean
): StopView | null {
  const stop = stopById.get(row[1])
  if (!stop) return null

  // GTFS repeats the same time in both columns at the ends of a trip, but a
  // train does not arrive where it starts or depart where it terminates.
  const [, , arrival, departure] = row
  const arrivalSeconds = isOrigin ? null : arrival
  const departureSeconds = isDestination ? null : departure

  const arrivalAt =
    arrivalSeconds == null ? null : serviceTime(startDate, arrivalSeconds)
  const departureAt =
    departureSeconds == null ? null : serviceTime(startDate, departureSeconds)

  const delay = update.arrival?.delay ?? update.departure?.delay

  return {
    stopId: stop.id,
    code: stop.code,
    name: stop.name,
    timezone: stop.tz || AGENCY_TIMEZONE,
    status,
    arrival: arrivalAt ? predicted(arrivalAt, update.arrival) : null,
    departure: departureAt ? predicted(departureAt, update.departure) : null,
    delayMinutes: typeof delay === "number" ? delay / 60 : null,
    cancelled: update.scheduleRelationship === "SKIPPED",
    showDwell:
      arrivalSeconds != null &&
      departureSeconds != null &&
      departureSeconds - arrivalSeconds > DWELL_THRESHOLD_SECONDS,
  }
}

export function toTrainViews(feeds: CanonicalFeeds): Array<TrainView> {
  const positions = new Map<string, Record<string, any>>()
  for (const entity of feeds.vehiclePositions.entity ?? []) {
    positions.set(entity.id, entity.vehicle)
  }

  const alertsByTrip = new Map<string, Array<AlertView>>()
  for (const entity of feeds.alerts.entity ?? []) {
    const alert = entity.alert
    const view: AlertView = {
      header: alert.headerText?.translation?.[0]?.text ?? "",
      description: alert.descriptionText?.translation?.[0]?.text ?? "",
      url: alert.url?.translation?.[0]?.text || null,
    }
    for (const informed of alert.informedEntity ?? []) {
      const tripId = informed.trip?.tripId
      if (!tripId) continue
      const list = alertsByTrip.get(tripId) ?? []
      list.push(view)
      alertsByTrip.set(tripId, list)
    }
  }

  const views: Array<TrainView> = []
  const seen = new Set<string>()

  for (const entity of feeds.tripUpdates.entity ?? []) {
    seen.add(entity.id)
    const update = entity.tripUpdate
    const tripId: string = update.trip.tripId
    const startDate: string = update.trip.startDate
    const trip = tripById.get(tripId)
    if (!trip) continue

    const schedule = stopTimes[tripId] ?? []
    const byStopId = new Map(schedule.map((row) => [row[1], row]))
    const updates: Array<Record<string, any>> = update.stopTimeUpdate ?? []

    // `eta === "ARR"` upstream becomes a published prediction here, so the last
    // stop carrying one is the last the train has called at.
    let lastVisited = -1
    for (let i = updates.length - 1; i >= 0; i--) {
      if (updates[i].arrival || updates[i].departure) {
        lastVisited = i
        break
      }
    }

    const stops = updates
      .map((stopUpdate, index) => {
        const row = byStopId.get(stopUpdate.stopId)
        if (!row) return null
        const status: StopStatus =
          index < lastVisited
            ? "left"
            : index === lastVisited
              ? "arrived"
              : "coming"
        return toStopView(
          stopUpdate,
          row,
          startDate,
          status,
          row[0] === schedule[0]?.[0],
          row[0] === schedule.at(-1)?.[0]
        )
      })
      .filter((stop) => stop !== null)

    const vehicle = positions.get(entity.id)
    const position: PositionView | null = vehicle?.position
      ? {
          lat: vehicle.position.latitude,
          lng: vehicle.position.longitude,
          bearing: vehicle.position.bearing ?? null,
          speedKmh: (vehicle.position.speed ?? 0) * KMH_PER_MS,
          at: new Date(Number(vehicle.timestamp) * 1000),
        }
      : null

    views.push({
      key: entity.id,
      number: trip.shortName,
      tripId,
      routeLongName: routeById.get(trip.routeId)?.longName ?? "",
      headsign: trip.headsign,
      startDate,
      position,
      stops,
      alerts: alertsByTrip.get(tripId) ?? [],
      stopsAreTruncated: stops.length < schedule.length,
    })
  }

  // A train the published schedule has never heard of still gets a pin: it has
  // a position and a number, just nothing to compare them against.
  for (const [key, vehicle] of positions) {
    if (seen.has(key) || !vehicle?.position) continue

    views.push({
      key,
      number: vehicle.vehicle?.label ?? key,
      tripId: null,
      routeLongName: "",
      headsign: "",
      startDate: "",
      position: {
        lat: vehicle.position.latitude,
        lng: vehicle.position.longitude,
        bearing: vehicle.position.bearing ?? null,
        speedKmh: (vehicle.position.speed ?? 0) * KMH_PER_MS,
        at: new Date(Number(vehicle.timestamp) * 1000),
      },
      stops: [],
      alerts: [],
      stopsAreTruncated: false,
    })
  }

  return views
}
