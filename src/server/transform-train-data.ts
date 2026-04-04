import { formatInTimeZone } from "date-fns-tz"
import type { AllTrainData, StationTime, Train } from "@/server/schemas/train"
import type {
  ProcessedStop,
  ProcessedTrain,
  ProcessedTrainData,
  StationStatus,
  TimePair,
} from "@/server/schemas/processed-train"

function deriveStationStatuses(
  times: Array<StationTime>,
  trainDeparted: boolean,
  trainArrived: boolean,
): Array<StationStatus> {
  if (!trainDeparted) {
    return times.map(() => "coming")
  }

  if (trainArrived) {
    return times.map((_, i) => (i === times.length - 1 ? "arrived" : "left"))
  }

  // Find the last station with eta === "ARR"
  let lastArrIndex = -1
  for (let i = times.length - 1; i >= 0; i--) {
    if (times[i].eta === "ARR") {
      lastArrIndex = i
      break
    }
  }

  return times.map((_, i) => {
    if (i < lastArrIndex) return "left"
    if (i === lastArrIndex) return "arrived"
    return "coming"
  })
}

function convertTimestamp(utcIso: string, timeZone: string): string {
  return formatInTimeZone(
    new Date(utcIso),
    timeZone,
    "yyyy-MM-dd'T'HH:mm:ssXXX",
  )
}

function toTimePair(
  raw: { scheduled: string; estimated?: string | null } | undefined,
  timeZone: string,
): TimePair | null {
  if (!raw) return null
  return {
    scheduled: convertTimestamp(raw.scheduled, timeZone),
    estimated: raw.estimated
      ? convertTimestamp(raw.estimated, timeZone)
      : null,
  }
}

function transformStop(
  raw: StationTime,
  status: StationStatus,
  timeZone: string,
): ProcessedStop {
  return {
    station: raw.station,
    code: raw.code,
    status,
    arrival: toTimePair(raw.arrival, timeZone),
    departure: toTimePair(raw.departure, timeZone),
    delayMinutes: raw.diffMin ?? null,
  }
}

function transformTrain(raw: Train, timeZone: string): ProcessedTrain {
  const statuses = deriveStationStatuses(raw.times, raw.departed, raw.arrived)

  return {
    lat: raw.lat ?? null,
    lng: raw.lng ?? null,
    speed: raw.speed ?? null,
    direction: raw.direction ?? null,
    from: raw.from,
    to: raw.to,
    instance: raw.instance,
    departed: raw.departed,
    arrived: raw.arrived,
    lastUpdated: raw.poll ?? null,
    alerts: raw.alerts ?? [],
    stops: raw.times.map((stop, i) =>
      transformStop(stop, statuses[i], timeZone),
    ),
  }
}

export function transformTrainData(
  raw: AllTrainData,
  timeZone: string,
): ProcessedTrainData {
  const result: ProcessedTrainData = {}
  for (const [id, train] of Object.entries(raw)) {
    result[id] = transformTrain(train, timeZone)
  }
  return result
}
