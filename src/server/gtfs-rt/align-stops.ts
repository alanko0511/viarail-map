import type { GtfsStopTime } from "@/data/gtfs"
import { stopByCode } from "@/data/gtfs"
import type { StationTime } from "@/server/schemas/train"

export interface AlignedStop {
  feedStop: StationTime
  stopId: string
  stopSequence: number
}

export interface Alignment {
  aligned: Array<AlignedStop>
  /** Feed stops with no place in the scheduled trip. */
  dropped: Array<StationTime>
}

/**
 * Matches the live feed's stop list onto a scheduled trip by station code.
 *
 * The tracker publishes a window rather than the whole trip — train 2 shows 25
 * of the Canadian's 67 stops — and occasionally calls at a station the trip
 * does not list. So this walks both lists forward rather than zipping them by
 * index, and a stop missing from the feed means "no prediction", never
 * "skipped".
 */
export function alignStops(
  times: Array<StationTime>,
  tripStopTimes: Array<GtfsStopTime> | undefined
): Alignment {
  const aligned: Array<AlignedStop> = []
  const dropped: Array<StationTime> = []
  const schedule = tripStopTimes ?? []
  let cursor = 0

  for (const feedStop of times) {
    const stopId = stopByCode.get(feedStop.code)?.id
    const index = stopId
      ? schedule.findIndex((row, i) => i >= cursor && row[1] === stopId)
      : -1

    if (index === -1 || !stopId) {
      dropped.push(feedStop)
      continue
    }

    aligned.push({ feedStop, stopId, stopSequence: schedule[index][0] })
    cursor = index + 1
  }

  return { aligned, dropped }
}
