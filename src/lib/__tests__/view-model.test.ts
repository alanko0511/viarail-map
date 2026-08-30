import { describe, expect, it } from "vitest"

import { toTrainViews } from "@/lib/view-model"
import { buildFeeds, toCanonicalJson } from "@/server/gtfs-rt/build-feed"
import type { AllTrainData } from "@/server/schemas/train"

import fixture from "../../server/__tests__/fixtures/all-train-data-2026-08-30.json"
import edgeFixture from "../../server/__tests__/fixtures/edge-cases.json"

const NOW = new Date("2026-08-30T15:17:32Z")

function views(input: unknown) {
  const feeds = buildFeeds(input as AllTrainData, NOW)
  return toTrainViews({
    tripUpdates: toCanonicalJson(feeds.tripUpdates),
    vehiclePositions: toCanonicalJson(feeds.vehiclePositions),
    alerts: toCanonicalJson(feeds.alerts),
  })
}

const trains = fixture as unknown as AllTrainData

describe("toTrainViews", () => {
  it("takes scheduled times from the schedule, not the realtime feed", () => {
    // Trip 516 leaves Toronto at 08:32 on its service day. GTFS stores that in
    // the agency's timezone, so the instant is 2026-08-30T08:32:00-04:00.
    const view = views(trains).find((train) => train.key === "52")!
    const toronto = view.stops[0]

    expect(toronto.code).toBe("TRTO")
    expect(toronto.departure!.scheduled.getTime() / 1000).toBe(1788093120)
  })

  it("falls back to the delay when the feed withheld a timestamp", () => {
    // The Ocean's departure slipped a day, so its timestamps are unusable and
    // the feed publishes delay alone. The prediction then comes from the
    // schedule: delay 0 means the train runs to its timetable.
    const view = views(trains).find((train) => train.key === "15")!
    const stop = view.stops.find(
      (s) => s.delayMinutes !== null && s.arrival !== null
    )!

    expect(stop.delayMinutes).toBe(0)
    expect(stop.arrival!.predicted!.getTime()).toBe(
      stop.arrival!.scheduled.getTime()
    )
  })

  it("prefers the feed's predicted timestamp over recomputing it", () => {
    // diffMin is whole minutes but the estimate carries seconds: Oshawa is
    // 8m36s late, which VIA rounds to 8 for the delay and shows as 9:17.
    // Rebuilding the time from scheduled + delay would round it up to 9:17:00
    // exactly, and further down the line that shows as a minute too late.
    const view = views(trains).find((train) => train.key === "52")!
    const oshawa = view.stops.find((stop) => stop.code === "OSHA")!

    expect(oshawa.arrival!.predicted!.getTime() / 1000).toBe(1788095856)
    expect(oshawa.delayMinutes).toBe(8)
  })

  it("leaves a stop with no prediction blank rather than on time", () => {
    // The Canadian predicts only the near part of its run.
    const view = views(trains).find((train) => train.key === "2 (08-28)")!
    const unknown = view.stops.find((stop) => stop.delayMinutes === null)!

    expect(unknown.arrival?.predicted ?? null).toBeNull()
    expect(unknown.delayMinutes).toBeNull()
    // The schedule still knows when it should get there.
    expect(unknown.arrival!.scheduled).toBeInstanceOf(Date)
  })

  it("keeps each stop in its own timezone", () => {
    // The Canadian crosses five zones between Vancouver and Toronto.
    const view = views(trains).find((train) => train.key === "2 (08-28)")!

    expect(view.stops[0].code).toBe("VCVR")
    expect(view.stops[0].timezone).toBe("America/Vancouver")
    expect(view.stops.at(-1)!.timezone).toBe("America/Winnipeg")
  })

  it("flags a train whose stop list is only part of its trip", () => {
    const all = views(trains)

    expect(all.find((t) => t.key === "2 (08-28)")!.stopsAreTruncated).toBe(true)
    expect(all.find((t) => t.key === "52")!.stopsAreTruncated).toBe(false)
  })

  it("shows a dwell only where the train actually waits", () => {
    const view = views(trains).find((train) => train.key === "2 (08-28)")!

    // Winnipeg is a servicing stop with a 90 minute layover.
    expect(view.stops.find((stop) => stop.code === "WNPG")!.showDwell).toBe(
      true
    )
    // Vancouver is the origin: it has a departure but nothing to wait for.
    expect(view.stops[0].showDwell).toBe(false)
  })

  it("keeps a train that reports no position", () => {
    // Two thirds of trains run to schedule with no GPS at all. They are still
    // real trains with real predictions.
    const untracked = views(trains).filter((train) => train.position === null)

    expect(untracked.length).toBeGreaterThan(0)
    expect(untracked.every((train) => train.stops.length > 0)).toBe(true)
  })

  it("gives the origin no arrival and the destination no departure", () => {
    // GTFS repeats the same time in both columns at the ends of a trip. A
    // train does not arrive at where it starts.
    const view = views(trains).find((train) => train.key === "52")!

    expect(view.stops[0].code).toBe("TRTO")
    expect(view.stops[0].arrival).toBeNull()
    expect(view.stops[0].departure).not.toBeNull()

    const last = view.stops.at(-1)!
    expect(last.code).toBe("OTTW")
    expect(last.departure).toBeNull()
    expect(last.arrival).not.toBeNull()
  })

  it("keeps a tracked train the schedule does not know", () => {
    // Seasonal services appear in the tracker before the published schedule
    // catches up. Dropping them would erase a train from the map.
    const view = views(edgeFixture).find((train) => train.key === "9999")!

    expect(view.tripId).toBeNull()
    expect(view.number).toBe("9999")
    expect(view.position!.lat).toBeCloseTo(45, 4)
    expect(view.stops).toEqual([])
  })

  it("reads a replaced stop as an alert against that stop's trip", () => {
    const view = views(edgeFixture).find((train) => train.key === "62")!

    expect(view.alerts.map((alert) => alert.header)).toContain(
      "Oshawa: service replaced"
    )
  })
})
