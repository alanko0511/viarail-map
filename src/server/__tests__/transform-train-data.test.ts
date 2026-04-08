import { describe, expect, it } from "vitest"
import fixtureData from "./fixtures/all-train-data.json"
import { AllTrainDataSchema } from "@/server/schemas/train"
import { transformTrainData } from "@/server/transform-train-data"

const TIME_ZONE = "America/Toronto"
const raw = AllTrainDataSchema.parse(fixtureData)
const processed = transformTrainData(raw, TIME_ZONE)

describe("transformTrainData", () => {
  it("transforms all trains from the fixture", () => {
    expect(Object.keys(processed).length).toBe(Object.keys(raw).length)
  })

  describe("en-route train", () => {
    // Train "1 (04-01)": departed=true, arrived=false
    const train = processed["1 (04-01)"]

    it("has correct top-level fields", () => {
      expect(train.departed).toBe(true)
      expect(train.arrived).toBe(false)
      expect(train.from).toBe("TORONTO")
      expect(train.to).toBe("VANCOUVER")
      expect(train.lat).toBeTypeOf("number")
      expect(train.lastUpdated).toBeTypeOf("string")
    })

    it("marks past stops as left", () => {
      const leftStops = train.stops.filter((s) => s.status === "left")
      expect(leftStops.length).toBeGreaterThan(0)
    })

    it("has exactly one arrived stop", () => {
      const arrivedStops = train.stops.filter((s) => s.status === "arrived")
      expect(arrivedStops).toHaveLength(1)
    })

    it("marks future stops as coming", () => {
      const comingStops = train.stops.filter((s) => s.status === "coming")
      expect(comingStops.length).toBeGreaterThan(0)
    })

    it("has statuses in order: left → arrived → coming", () => {
      const statuses = train.stops.map((s) => s.status)
      const firstArrived = statuses.indexOf("arrived")
      const firstComing = statuses.indexOf("coming")

      // All stops before "arrived" should be "left"
      for (let i = 0; i < firstArrived; i++) {
        expect(statuses[i]).toBe("left")
      }
      // All stops after "arrived" should be "coming"
      for (let i = firstComing; i < statuses.length; i++) {
        expect(statuses[i]).toBe("coming")
      }
    })
  })

  describe("arrived train", () => {
    // Train "15": departed=true, arrived=true
    const train = processed["15"]

    it("marks all stops except last as left", () => {
      const allButLast = train.stops.slice(0, -1)
      expect(allButLast.every((s) => s.status === "left")).toBe(true)
    })

    it("marks last stop as arrived", () => {
      expect(train.stops.at(-1)!.status).toBe("arrived")
    })
  })

  describe("not-departed train", () => {
    // Train "692 (04-04)": departed=false, arrived=false
    const train = processed["692 (04-04)"]

    it("marks all stops as coming", () => {
      expect(train.stops.every((s) => s.status === "coming")).toBe(true)
    })

    it("has null location fields", () => {
      expect(train.lat).toBeNull()
      expect(train.lng).toBeNull()
      expect(train.lastUpdated).toBeNull()
    })
  })

  describe("stop field mapping", () => {
    // Train "15" first stop (Halifax) — origin, no arrival
    const train = processed["15"]
    const origin = train.stops[0]
    const destination = train.stops.at(-1)!

    it("origin has no arrival, has departure", () => {
      expect(origin.arrival).toBeNull()
      expect(origin.departure).not.toBeNull()
      expect(origin.departure!.scheduled).toBeTypeOf("string")
    })

    it("destination has arrival, no departure", () => {
      expect(destination.arrival).not.toBeNull()
      expect(destination.arrival!.scheduled).toBeTypeOf("string")
      expect(destination.departure).toBeNull()
    })

    it("populates delayMinutes from diffMin", () => {
      // Origin of train 15 (Halifax) has diff data since it already departed
      const stopWithDelay = train.stops.find((s) => s.delayMinutes !== null)
      expect(stopWithDelay).toBeDefined()
      expect(stopWithDelay!.delayMinutes).toBeTypeOf("number")
    })

    it("sets delayMinutes to null when diffMin is missing", () => {
      // Not-departed train has no delay data
      const notDeparted = processed["692 (04-04)"]
      expect(notDeparted.stops[0].delayMinutes).toBeNull()
    })
  })

  describe("timezone conversion", () => {
    it("converts UTC timestamps to the specified timezone", () => {
      const train = processed["15"]
      const origin = train.stops[0]
      // Halifax departure scheduled is 2026-04-03T14:30:00Z (UTC)
      // In America/Toronto (EDT, UTC-4): 2026-04-03T10:30:00-04:00
      expect(origin.departure!.scheduled).toBe("2026-04-03T10:30:00-04:00")
    })

    it("converts to a different timezone", () => {
      const pacificProcessed = transformTrainData(raw, "America/Vancouver")
      const train = pacificProcessed["15"]
      const origin = train.stops[0]
      // In America/Vancouver (PDT, UTC-7): 2026-04-03T07:30:00-07:00
      expect(origin.departure!.scheduled).toBe("2026-04-03T07:30:00-07:00")
    })
  })

  describe("alerts", () => {
    it("defaults to empty array when no alerts", () => {
      const trainWithoutAlerts = Object.values(processed).find(
        (t) => t.alerts.length === 0,
      )
      expect(trainWithoutAlerts).toBeDefined()
      expect(trainWithoutAlerts!.alerts).toEqual([])
    })

    it("preserves alerts when present", () => {
      const trainWithAlerts = Object.values(processed).find(
        (t) => t.alerts.length > 0,
      )
      expect(trainWithAlerts).toBeDefined()
      expect(trainWithAlerts!.alerts[0]).toHaveProperty("header")
    })
  })
})
