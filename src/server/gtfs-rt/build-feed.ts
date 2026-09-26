import { transit_realtime as rt } from "gtfs-realtime-bindings"

import { stopByCode, stopTimes } from "@/data/gtfs"
import { serviceTime } from "@/lib/service-time"
import type { AlignedStop } from "@/server/gtfs-rt/align-stops"
import { alignStops } from "@/server/gtfs-rt/align-stops"
import { decodeEntities } from "@/server/gtfs-rt/html-entities"
import type { TripMatch } from "@/server/gtfs-rt/resolve-trip"
import { resolveTrip, trainNumber } from "@/server/gtfs-rt/resolve-trip"
import type {
  Alert,
  AllTrainData,
  ScheduledTime,
  Train,
} from "@/server/schemas/train"

/**
 * Protobuf's canonical JSON mapping: lowerCamelCase names, enum names as
 * strings, and int64 as decimal strings. GTFS-RT itself is protobuf-only, so
 * the JSON we publish is a convenience mirror of the same FeedMessage rather
 * than a second format.
 */
export function toCanonicalJson(feed: rt.FeedMessage): Record<string, unknown> {
  return rt.FeedMessage.toObject(feed, {
    enums: String,
    longs: String,
    defaults: false,
    arrays: false,
    objects: false,
    oneofs: true,
  })
}

export interface Feeds {
  tripUpdates: rt.FeedMessage
  vehiclePositions: rt.FeedMessage
  alerts: rt.FeedMessage
}

function header(now: Date): rt.IFeedHeader {
  return {
    gtfsRealtimeVersion: "2.0",
    incrementality: rt.FeedHeader.Incrementality.FULL_DATASET,
    timestamp: Math.floor(now.getTime() / 1000),
  }
}

/** VIA Rail's agency_id in the published schedule. */
const AGENCY_ID = "1"

/** GTFS-RT reports speed in metres per second; the tracker reports km/h. */
const KMH_TO_MS = 1 / 3.6

interface TripPlan {
  match: TripMatch
  aligned: Array<AlignedStop>
  /**
   * The tracker is running this departure to a timetable the static schedule
   * does not have, such as the adjusted times around a track closure.
   */
  replacement: boolean
}

/**
 * How far the tracker's timetable must stray from GTFS before it counts as a
 * different schedule. The two disagree by a minute or two at a handful of stops
 * on an ordinary day, which is rounding, not a change of plan.
 */
const RESCHEDULED_MS = 5 * 60 * 1000

/** Whether the tracker schedules this event away from the GTFS time. */
function rescheduled(
  time: ScheduledTime | undefined,
  seconds: number | null,
  startDate: string
): boolean {
  if (!time || seconds == null) return false
  const scheduled = Date.parse(time.scheduled)
  const planned = serviceTime(startDate, seconds).getTime()
  return Math.abs(scheduled - planned) >= RESCHEDULED_MS
}

/**
 * Resolves a train to its scheduled trip and decides how to publish it.
 *
 * GTFS-RT wants a departure running to a modified schedule published as a
 * REPLACEMENT carrying the complete journey, since the static stop_times no
 * longer describe it. That needs the tracker to list the whole trip, so a
 * truncated stop list stays SCHEDULED whatever its times say.
 */
function planTrip(feedKey: string, train: Train): TripPlan | null {
  const match = resolveTrip(feedKey, train)
  if (!match) return null

  const schedule = stopTimes[match.tripId] ?? []
  const { aligned } = alignStops(train.times, schedule)
  const startDate = train.instance.replaceAll("-", "")

  const complete =
    aligned.length > 0 &&
    aligned[0].stopSequence === schedule[0]?.[0] &&
    aligned.at(-1)!.stopSequence === schedule.at(-1)?.[0]
  const replacement =
    complete &&
    aligned.some(
      ({ feedStop, row }) =>
        rescheduled(feedStop.arrival, row[2], startDate) ||
        rescheduled(feedStop.departure, row[3], startDate)
    )

  return { match, aligned, replacement }
}

function tripDescriptor(plan: TripPlan, train: Train): rt.ITripDescriptor {
  return {
    tripId: plan.match.tripId,
    routeId: plan.match.routeId,
    startDate: train.instance.replaceAll("-", ""),
    scheduleRelationship: plan.replacement
      ? rt.TripDescriptor.ScheduleRelationship.REPLACEMENT
      : rt.TripDescriptor.ScheduleRelationship.SCHEDULED,
  }
}

/**
 * Index of the last stop the train has actually called at. `eta === "ARR"` is
 * the only marker upstream gives; the train-level `departed` flag tracks GPS
 * presence rather than departure, so it cannot be used here.
 */
function lastArrivedIndex(train: Train): number {
  for (let i = train.times.length - 1; i >= 0; i--) {
    if (train.times[i].eta === "ARR") return i
  }
  return -1
}

/**
 * Where the train is relative to its stop list. A stationary train whose
 * departure estimate has not passed is still standing at the platform;
 * otherwise it is running towards the next stop.
 */
function currentStop(train: Train, now: Date) {
  const index = lastArrivedIndex(train)
  if (index === -1) return null

  const stop = train.times[index]
  const departure = stop.departure?.estimated
  const stopped =
    train.speed === 0 &&
    departure != null &&
    Date.parse(departure) > now.getTime()

  // Past the last stop there is nowhere to be in transit to, so a train that
  // has called at the end of its list is standing there.
  const next = stopped ? undefined : train.times[index + 1]

  return next
    ? {
        code: next.code,
        status: rt.VehiclePosition.VehicleStopStatus.IN_TRANSIT_TO,
      }
    : {
        code: stop.code,
        status: rt.VehiclePosition.VehicleStopStatus.STOPPED_AT,
      }
}

function vehicleEntity(
  feedKey: string,
  train: Train,
  now: Date
): rt.IFeedEntity | null {
  if (train.lat == null || train.lng == null) return null

  const plan = planTrip(feedKey, train)
  const target = currentStop(train, now)
  const placed = target
    ? plan?.aligned.find((stop) => stop.feedStop.code === target.code)
    : undefined

  return {
    id: feedKey,
    vehicle: {
      trip: plan ? tripDescriptor(plan, train) : undefined,
      vehicle: { id: feedKey, label: trainNumber(feedKey) },
      position: {
        latitude: train.lat,
        longitude: train.lng,
        // A null bearing means unknown. Sending 0 would claim due north.
        bearing: train.direction ?? undefined,
        speed: train.speed == null ? undefined : train.speed * KMH_TO_MS,
      },
      currentStatus: target?.status,
      stopId: placed?.stopId,
      currentStopSequence: placed?.stopSequence,
      timestamp: train.poll
        ? Math.floor(Date.parse(train.poll) / 1000)
        : undefined,
    },
  }
}

/**
 * Builds one arrival or departure prediction.
 *
 * `delay` is authoritative: upstream computes lateness modulo the service day,
 * so a raw `estimated - scheduled` subtraction is wrong for trains whose
 * departure slipped to another day. The absolute `time` is published only when
 * it agrees with `scheduled + delay`, which GTFS-RT requires when both are set.
 */
function stopTimeEvent(
  time: ScheduledTime | undefined,
  delayMinutes: number
): rt.TripUpdate.IStopTimeEvent {
  const delay = delayMinutes * 60
  const event: rt.TripUpdate.IStopTimeEvent = { delay }

  const estimated = time?.estimated
  const scheduled = time?.scheduled
  if (!estimated || !scheduled) return event

  const predicted = Math.floor(Date.parse(estimated) / 1000)
  const expected = Math.floor(Date.parse(scheduled) / 1000) + delay
  if (Number.isFinite(predicted) && Math.abs(predicted - expected) <= 60) {
    event.time = predicted
  }

  return event
}

/**
 * One stop of a replacement trip. Its timetable is the tracker's, so both
 * events are required and each carries its scheduled time, with the prediction
 * alongside when there is one. The delay is measured from that same timetable,
 * which is what VIA reports it against.
 */
function replacementUpdate({
  feedStop,
  stopId,
  stopSequence,
}: AlignedStop): rt.TripUpdate.IStopTimeUpdate {
  // A train neither arrives where it starts nor departs where it terminates,
  // but a replacement stop needs both events, so the one stands in for the
  // other.
  const arrival = feedStop.arrival ?? feedStop.departure
  const departure = feedStop.departure ?? feedStop.arrival
  const delayMinutes = feedStop.diffMin
  const predicting = !feedStop.cancelled && delayMinutes != null

  const event = (
    time: ScheduledTime | undefined
  ): rt.TripUpdate.IStopTimeEvent => {
    const scheduledTime = time
      ? Math.floor(Date.parse(time.scheduled) / 1000)
      : undefined
    if (!predicting || scheduledTime == null) return { scheduledTime }

    // A replacement trip must publish the absolute time, so where the
    // estimate cannot be trusted it is rebuilt from the delay instead.
    const prediction = stopTimeEvent(time, delayMinutes)
    return {
      ...prediction,
      scheduledTime,
      time: prediction.time ?? scheduledTime + delayMinutes * 60,
    }
  }

  return {
    stopId,
    stopSequence,
    scheduleRelationship: feedStop.cancelled
      ? rt.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED
      : predicting
        ? rt.TripUpdate.StopTimeUpdate.ScheduleRelationship.SCHEDULED
        : rt.TripUpdate.StopTimeUpdate.ScheduleRelationship.NO_DATA,
    arrival: event(arrival),
    departure: event(departure),
  }
}

function tripUpdateEntity(
  feedKey: string,
  train: Train
): rt.IFeedEntity | null {
  const plan = planTrip(feedKey, train)
  if (!plan) return null

  const stopTimeUpdate = plan.aligned.map((stop) => {
    if (plan.replacement) return replacementUpdate(stop)

    const { feedStop, stopId, stopSequence } = stop
    const update: rt.TripUpdate.IStopTimeUpdate = { stopId, stopSequence }
    const delayMinutes = feedStop.diffMin

    if (feedStop.cancelled) {
      update.scheduleRelationship =
        rt.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED
      return update
    }

    // No estimate upstream means no prediction, which is not the same as
    // on time. NO_DATA tells consumers to fall back to the schedule.
    if (delayMinutes == null) {
      update.scheduleRelationship =
        rt.TripUpdate.StopTimeUpdate.ScheduleRelationship.NO_DATA
      return update
    }

    if (feedStop.arrival) {
      update.arrival = stopTimeEvent(feedStop.arrival, delayMinutes)
    }
    if (feedStop.departure) {
      update.departure = stopTimeEvent(feedStop.departure, delayMinutes)
    }
    return update
  })

  return {
    id: feedKey,
    tripUpdate: {
      trip: tripDescriptor(plan, train),
      vehicle: { id: feedKey, label: trainNumber(feedKey) },
      stopTimeUpdate,
    },
  }
}

function translated(en: string, fr: string): rt.ITranslatedString {
  return {
    translation: [
      { text: decodeEntities(en), language: "en" },
      { text: decodeEntities(fr), language: "fr" },
    ],
  }
}

/** Identifies the trip and, for a stop-level alert, the stop it concerns. */
function informedEntity(
  feedKey: string,
  train: Train,
  stopId?: string
): rt.IEntitySelector {
  const match = resolveTrip(feedKey, train)
  if (!match) return { agencyId: AGENCY_ID }

  return {
    routeId: match.routeId,
    stopId,
    trip: {
      tripId: match.tripId,
      startDate: train.instance.replaceAll("-", ""),
    },
  }
}

/**
 * Collects service alerts, folding duplicates together.
 *
 * Upstream repeats the same advisory verbatim on every train it touches, so the
 * text is the identity: one alert entity per distinct message, listing all the
 * trips it affects.
 */
function alertEntities(trains: AllTrainData): Array<rt.IFeedEntity> {
  const grouped = new Map<
    string,
    { alert: Alert; informed: Array<rt.IEntitySelector> }
  >()

  for (const [feedKey, train] of Object.entries(trains)) {
    for (const alert of train.alerts ?? []) {
      const key = `${alert.header.en}\u0000${alert.description.en}\u0000${alert.url.en}`
      const group = grouped.get(key) ?? { alert, informed: [] }
      group.informed.push(informedEntity(feedKey, train))
      grouped.set(key, group)
    }
  }

  const entities = [...grouped.values()].map(({ alert, informed }, index) => ({
    id: `alert-${index}`,
    alert: {
      cause: rt.Alert.Cause.UNKNOWN_CAUSE,
      effect: rt.Alert.Effect.OTHER_EFFECT,
      informedEntity: informed,
      headerText: translated(alert.header.en, alert.header.fr),
      descriptionText: translated(alert.description.en, alert.description.fr),
      // An empty TranslatedString is worse than no url at all.
      url: alert.url.en ? translated(alert.url.en, alert.url.fr) : undefined,
    },
  }))

  // A stop served by a substitute train has no GTFS-RT equivalent, so it is
  // published as an alert against that stop.
  for (const [feedKey, train] of Object.entries(trains)) {
    for (const stop of train.times) {
      if (!stop.replaced) continue

      const services = stop.replaced.services.join(", ")
      const stopId = stopByCode.get(stop.code)?.id
      entities.push({
        id: `replaced-${feedKey}-${stop.code}`,
        alert: {
          cause: rt.Alert.Cause.UNKNOWN_CAUSE,
          effect: rt.Alert.Effect.MODIFIED_SERVICE,
          informedEntity: [informedEntity(feedKey, train, stopId)],
          headerText: translated(
            `${stop.station}: service replaced`,
            `${stop.station} : service remplacé`
          ),
          descriptionText: translated(
            `This stop is served by ${stop.replaced.mode} ${services}.`,
            `Cet arrêt est desservi par ${stop.replaced.mode} ${services}.`
          ),
          url: undefined,
        },
      })
    }
  }

  return entities
}

export function buildFeeds(trains: AllTrainData, now: Date): Feeds {
  const entries = Object.entries(trains)

  const updates = entries
    .map(([feedKey, train]) => tripUpdateEntity(feedKey, train))
    .filter((entity) => entity !== null)

  const vehicles = entries
    .map(([feedKey, train]) => vehicleEntity(feedKey, train, now))
    .filter((entity) => entity !== null)

  return {
    tripUpdates: rt.FeedMessage.create({
      header: header(now),
      entity: updates,
    }),
    vehiclePositions: rt.FeedMessage.create({
      header: header(now),
      entity: vehicles,
    }),
    alerts: rt.FeedMessage.create({
      header: header(now),
      entity: alertEntities(trains),
    }),
  }
}
