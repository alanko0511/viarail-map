import { describe, expect, it } from "vitest"

import { consistQuery, summarizeConsist } from "@/lib/consist"
import type { TrainView } from "@/lib/view-model"
import type { ConsistResponse } from "@/server/schemas/consist"
import { ConsistResponseSchema } from "@/server/schemas/consist"

import train1 from "./fixtures/consist-train-1.json"
import train40 from "./fixtures/consist-train-40.json"
import train75 from "./fixtures/consist-train-75.json"

// Captured live from traincar.info; seat objects are emptied since only their
// count is read.
const canadian = ConsistResponseSchema.parse(train1)
const corridorVenture = ConsistResponseSchema.parse(train40)
const corridorMixed = ConsistResponseSchema.parse(train75)

function seatsFor(response: ConsistResponse, label: string) {
  return summarizeConsist(response).classes.find(
    (entry) => entry.label === label
  )
}

describe("summarizeConsist", () => {
  it("reports a uniform Venture trainset", () => {
    const summary = summarizeConsist(corridorVenture)

    expect(summary.carCount).toBe(5)
    expect(summary.equipment).toEqual(["Siemens Venture"])
    expect(summary.classes).toEqual([
      { label: "Business", cars: 2, seats: 88 },
      { label: "Economy", cars: 3, seats: 191 },
    ])
  })

  it("names every fleet type in a mixed consist", () => {
    const summary = summarizeConsist(corridorMixed)

    expect(summary.carCount).toBe(7)
    // Train 75 runs LRC cars with one HEP2 business car spliced in, and the
    // badge has to say so rather than picking whichever car came first.
    expect(summary.equipment).toEqual(["LRC", "HEP2"])
    expect(seatsFor(corridorMixed, "Economy")).toEqual({
      label: "Economy",
      cars: 5,
      seats: 340,
    })
    expect(seatsFor(corridorMixed, "Business")).toEqual({
      label: "Business",
      cars: 2,
      seats: 90,
    })
  })

  it("classifies the Canadian's service cars from their car number", () => {
    const summary = summarizeConsist(canadian)

    expect(summary.carCount).toBe(20)
    // The VIDE shells share one catch-all carriage_type, so Baggage, Dome,
    // Dining and Crew can only be told apart by carriage_number.
    expect(seatsFor(canadian, "Baggage")).toEqual({
      label: "Baggage",
      cars: 1,
      seats: 0,
    })
    expect(seatsFor(canadian, "Dome")).toEqual({
      label: "Dome",
      cars: 3,
      seats: 0,
    })
    expect(seatsFor(canadian, "Dining")).toEqual({
      label: "Dining",
      cars: 2,
      seats: 0,
    })
    expect(seatsFor(canadian, "Crew")).toEqual({
      label: "Crew",
      cars: 1,
      seats: 0,
    })
    // Prestige sleepers say "Sleeper" too, so they must not be double-counted
    // into the plain Sleeper rollup.
    expect(seatsFor(canadian, "Sleeper")?.cars).toBe(8)
    expect(seatsFor(canadian, "Prestige")?.cars).toBe(3)
    // The shells are placeholders, not a fleet type of their own.
    expect(summary.equipment).not.toContain("VID")
  })

  it("orders revenue classes ahead of service cars", () => {
    const labels = summarizeConsist(canadian).classes.map(
      (entry) => entry.label
    )

    expect(labels.indexOf("Economy")).toBeLessThan(labels.indexOf("Dining"))
    expect(labels.indexOf("Sleeper")).toBeLessThan(labels.indexOf("Baggage"))
  })

  it("handles an empty consist without throwing", () => {
    const summary = summarizeConsist({ carriages: [] })

    expect(summary).toEqual({ carCount: 0, equipment: [], classes: [] })
  })
})

function trainView(overrides: Partial<TrainView>): TrainView {
  return {
    key: "40 (08-31)",
    number: "40",
    tripId: null,
    routeLongName: "Ottawa - Toronto",
    headsign: "Ottawa",
    startDate: "20260831",
    position: null,
    stops: [],
    alerts: [],
    stopsAreTruncated: false,
    ...overrides,
  }
}

describe("consistQuery", () => {
  it("returns null when the train matched no scheduled trip", () => {
    expect(consistQuery(trainView({ tripId: null }))).toBeNull()
  })

  it("takes the endpoints from the GTFS trip, not the tracker stop list", () => {
    // Trip 458 is train 40, Toronto to Ottawa. The tracker often truncates the
    // stop list, so a mid-route origin here would make the reservation system
    // answer "Requested station not found on requested service".
    const query = consistQuery(
      trainView({ tripId: "458", stopsAreTruncated: true })
    )

    expect(query).toEqual({
      number: "40",
      date: "2026-08-31",
      origin: "TRTO",
      destination: "OTTW",
    })
  })
})
