import { describe, expect, it } from "vitest"

import { resolveTrip } from "@/server/gtfs-rt/resolve-trip"
import type { AllTrainData, Train } from "@/server/schemas/train"

import fixture from "../../__tests__/fixtures/all-train-data-2026-08-30.json"

function train(overrides: Partial<Train> = {}): Train {
  return {
    departed: true,
    arrived: false,
    from: "TORONTO",
    to: "VANCOUVER",
    instance: "2026-08-30",
    times: [],
    ...overrides,
  }
}

describe("resolveTrip", () => {
  it("resolves a train number to the trip with that trip_short_name", () => {
    // trips.txt: 8-119,111,111,111,1,Vancouver,1,VIA1
    const match = resolveTrip("1 (08-30)", train())

    expect(match?.tripId).toBe("111")
    expect(match?.routeId).toBe("8-119")
  })

  it("resolves a joint service whose trip_short_name is hyphenated", () => {
    // The Maple Leaf runs as 97 southbound; trips.txt calls the trip "97-64".
    expect(resolveTrip("97", train())?.tripId).toBe("502")
  })

  it("prefers an exact trip_short_name over a hyphen component", () => {
    // Trip 472 is named "63"; trip 503 is the Maple Leaf, named "98-63".
    // A request for train 63 means the Corridor run, not the Maple Leaf.
    expect(resolveTrip("63", train())?.tripId).toBe("472")
    expect(resolveTrip("64", train())?.tripId).toBe("475")
  })

  it("disambiguates a repeated train number by the service calendar", () => {
    // Train 26 has two trips. calendar.txt: service 95 runs Fridays only;
    // service 541 runs every day except Friday.
    expect(resolveTrip("26", train({ instance: "2026-09-04" }))?.tripId).toBe(
      "95"
    ) // a Friday
    expect(resolveTrip("26", train({ instance: "2026-09-08" }))?.tripId).toBe(
      "541"
    ) // a Tuesday
  })

  it("returns null for a train number the schedule does not know", () => {
    // An unresolvable trip must not throw: the train still gets a
    // VehiclePosition, just without a TripDescriptor.
    expect(resolveTrip("99999", train())).toBeNull()
  })

  it("resolves every train in the captured feed, and never the Air Connect bus", () => {
    // Trip 554 is the Dorval airport shuttle. Its trip_short_name is empty, so
    // no train number should ever reach it.
    const trains = fixture as unknown as AllTrainData

    const unresolved = Object.keys(trains).filter(
      (key) => resolveTrip(key, trains[key]) === null
    )
    expect(unresolved).toEqual([])

    const matched = Object.keys(trains).map(
      (key) => resolveTrip(key, trains[key])!.tripId
    )
    expect(matched).not.toContain("554")
  })
})
