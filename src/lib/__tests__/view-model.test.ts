import { describe, expect, it } from "vitest"

import { toTrainViews } from "@/lib/view-model"
import { buildFeeds, toCanonicalJson } from "@/server/gtfs-rt/build-feed"
import type { AllTrainData } from "@/server/schemas/train"

import fixture from "../../server/__tests__/fixtures/all-train-data-2026-08-30.json"
import edgeFixture from "../../server/__tests__/fixtures/edge-cases.json"
import detourFixture from "../../server/__tests__/fixtures/guildwood-detour-2026-09-26.json"

const NOW = new Date("2026-08-30T15:17:32Z")
const DETOUR_NOW = new Date("2026-09-26T12:41:00Z")

function views(input: unknown, now: Date = NOW) {
  const feeds = buildFeeds(input as AllTrainData, now)
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

  it("shows an alert once on each departure it names", () => {
    // Both running Canadians carry the same advisory and share trip 111, so
    // the feed folds them into one alert naming that trip twice, once per
    // service date.
    const canadians = views(trains).filter((train) => train.number === "1")

    expect(canadians).toHaveLength(2)
    for (const view of canadians) expect(view.alerts).toHaveLength(1)
  })

  it("keeps one departure's alert off another departure of the same train", () => {
    const quiet = structuredClone(trains)
    quiet["1 (08-26)"].alerts = []
    const byKey = new Map(views(quiet).map((view) => [view.key, view]))

    expect(byKey.get("1 (08-26)")!.alerts).toEqual([])
    expect(byKey.get("1 (08-30)")!.alerts).toHaveLength(1)
  })

  it("numbers a joint service by its own train, not the pair", () => {
    // The Maple Leaf's GTFS trip is "97-64"; the tracker runs it as train 97,
    // and that is the number traincar.info and passengers know it by.
    const view = views(trains).find((train) => train.key === "97")!

    expect(view.number).toBe("97")
  })

  it("does not read a prediction for a future stop as a visit", () => {
    // Train 45 has called at Ottawa and Fallowfield; the tracker still gives
    // Kingston and Toronto an estimate and a delay, which is a forecast, not an
    // arrival. The vehicle feed places the train, and that is what decides.
    const view = views(trains).find((train) => train.key === "45")!

    expect(view.stops.map((stop) => `${stop.code}:${stop.status}`)).toEqual([
      "OTTW:left",
      "FALL:arrived",
      "KGON:coming",
      "TRTO:coming",
    ])
  })

  it("leaves a train standing at the last stop it has reached", () => {
    // Train 70 has arrived at Toronto, the end of its list. There is no next
    // stop to be in transit to, so the terminus reads as arrived rather than
    // dropping the train's place on the line entirely.
    const view = views(trains).find((train) => train.key === "70")!

    expect(view.stops.at(-1)).toMatchObject({ code: "TRTO", status: "arrived" })
    expect(view.stops.at(-2)!.status).toBe("left")
  })

  it("counts a train standing at a stop as having reached it", () => {
    // Train 692 has no GPS, so its place comes from the estimates alone. At
    // 13:00 local it is an hour into a 96-minute stand at Thompson: the arrival
    // is behind it and the departure is not. Reading the departure first would
    // put the train short of a station it is sitting in.
    const view = views(trains, new Date("2026-08-30T18:00:00Z")).find(
      (train) => train.key === "692"
    )!
    const thompson = view.stops.findIndex((stop) => stop.code === "THOM")

    expect(view.stops[thompson].status).toBe("arrived")
    expect(view.stops[thompson - 1].status).toBe("left")
    expect(view.stops[thompson + 1].status).toBe("coming")
  })

  it("shows a retimed train against the timetable it is running to", () => {
    // GTFS has train 643 at Oshawa at 12:35 and Toronto at 13:18. For the
    // Guildwood closure VIA moved them to 12:02 and 13:32, and the train is a
    // minute behind that, which is what VIA's own tracker shows.
    const view = views(detourFixture, DETOUR_NOW).find(
      (train) => train.key === "643"
    )!
    const oshawa = view.stops.find((stop) => stop.code === "OSHA")!
    const toronto = view.stops.at(-1)!

    expect(view.scheduleModified).toBe(true)
    expect(oshawa.arrival!.scheduled.getTime() / 1000).toBe(1790438520)
    expect(oshawa.arrival!.predicted!.getTime() / 1000).toBe(1790438606)
    expect(oshawa.delayMinutes).toBe(1)
    expect(toronto.code).toBe("TRTO")
    expect(toronto.arrival!.scheduled.getTime() / 1000).toBe(1790443920)
  })

  it("drops a stop the retimed train skips without calling the list partial", () => {
    // Guildwood is in trip 461 but closed today. The replacement is the whole
    // journey, so its absence is a skipped station, not a truncated feed.
    const view = views(detourFixture, DETOUR_NOW).find(
      (train) => train.key === "643"
    )!

    expect(view.stops.map((stop) => stop.code)).not.toContain("GUIL")
    expect(view.stopsAreTruncated).toBe(false)
  })

  it("gives a retimed origin no arrival and its terminus no departure", () => {
    const view = views(detourFixture, DETOUR_NOW).find(
      (train) => train.key === "643"
    )!

    expect(view.stops[0].arrival).toBeNull()
    expect(view.stops[0].departure!.scheduled.getTime() / 1000).toBe(1790425740)
    expect(view.stops.at(-1)!.departure).toBeNull()
  })
})
