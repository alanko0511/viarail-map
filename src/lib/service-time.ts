import { fromZonedTime } from "date-fns-tz"

/** VIA's agency_timezone. GTFS stop_times are stored in it, whatever the stop's
 * own timezone: the Canadian's 15:00 departure from Vancouver is written
 * 18:00:00 because that is the hour in Toronto. */
export const AGENCY_TIMEZONE = "America/Toronto"

/**
 * Resolves a GTFS time to a real instant.
 *
 * GTFS counts seconds from noon minus twelve hours on the service day, which is
 * midnight except when the clocks change. Times past 86400 belong to the next
 * calendar day and are meant to run over, so no wrapping happens here.
 */
export function serviceTime(startDate: string, seconds: number): Date {
  const day = `${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)}`
  const noon = fromZonedTime(`${day}T12:00:00`, AGENCY_TIMEZONE)
  return new Date(noon.getTime() - 12 * 3600 * 1000 + seconds * 1000)
}
