/** Renders an instant in the station's own timezone, not the reader's. */
export function formatStopTime(at: Date, timeZone: string): string {
  return at.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  })
}
