import { transit_realtime as rt } from "gtfs-realtime-bindings"
import { Writer } from "protobufjs/minimal"
import { describe, expect, it } from "vitest"

import { buildFeeds, toCanonicalJson } from "@/server/gtfs-rt/build-feed"
import type { AllTrainData } from "@/server/schemas/train"

import fixture from "../../__tests__/fixtures/all-train-data-2026-08-30.json"
import edgeFixture from "../../__tests__/fixtures/edge-cases.json"

const trains = fixture as unknown as AllTrainData
const edgeCases = edgeFixture as unknown as AllTrainData
const NOW = new Date("2026-08-30T15:17:32Z")

describe("buildFeeds", () => {
  it("stamps every feed with a spec-compliant header", () => {
    const feeds = buildFeeds(trains, NOW)

    for (const feed of [
      feeds.tripUpdates,
      feeds.vehiclePositions,
      feeds.alerts,
    ]) {
      expect(feed.header.gtfsRealtimeVersion).toBe("2.0")
      expect(feed.header.incrementality).toBe(0) // FULL_DATASET
      expect(Number(feed.header.timestamp)).toBe(1788103052)
    }
  })

  it("publishes a position only for trains that have a GPS fix", () => {
    // 22 of the 64 trains in this capture carry lat/lng; the rest are
    // scheduled but untracked.
    const feed = buildFeeds(trains, NOW).vehiclePositions

    expect(feed.entity).toHaveLength(22)
    expect(feed.entity.some((e) => e.vehicle?.vehicle?.label === "15")).toBe(
      true
    )
    expect(feed.entity.some((e) => e.vehicle?.vehicle?.label === "73")).toBe(
      false
    )
  })

  it("converts speed to metres per second and keeps the bearing", () => {
    // Train 52 reports 22 km/h on a bearing of 51.99 degrees. GTFS-RT speed is
    // metres per second, so 22 / 3.6.
    const feed = buildFeeds(trains, NOW).vehiclePositions
    const position = feed.entity.find(
      (e) => e.vehicle?.vehicle?.label === "52"
    )!.vehicle!.position!

    expect(position.latitude).toBeCloseTo(44.2567, 4)
    expect(position.longitude).toBeCloseTo(-76.5372, 4)
    expect(position.speed).toBeCloseTo(6.1111, 4)
    expect(position.bearing).toBeCloseTo(51.99, 2)
  })

  it("timestamps a position from the GPS poll, the one UTC field upstream", () => {
    // Train 52's poll is 2026-08-30T15:16:04Z.
    const feed = buildFeeds(trains, NOW).vehiclePositions
    const vehicle = feed.entity.find(
      (e) => e.vehicle?.vehicle?.label === "52"
    )!.vehicle!

    expect(Number(vehicle.timestamp)).toBe(1788102964)
  })

  it("reports a moving train as in transit to the stop after its last arrival", () => {
    // Train 52 has ARR through Kingston; Brockville is next. In trip 516,
    // Brockville is stop_id 35 at sequence 7.
    const feed = buildFeeds(trains, NOW).vehiclePositions
    const vehicle = feed.entity.find(
      (e) => e.vehicle?.vehicle?.label === "52"
    )!.vehicle!

    expect(vehicle.currentStatus).toBe(
      rt.VehiclePosition.VehicleStopStatus.IN_TRANSIT_TO
    )
    expect(vehicle.stopId).toBe("35")
    expect(vehicle.currentStopSequence).toBe(7)
  })

  it("reports a halted train as stopped at its last arrival", () => {
    // Train 65 is stationary at Dorval (stop_id 332) with its departure
    // estimate still in the future.
    const feed = buildFeeds(trains, NOW).vehiclePositions
    const vehicle = feed.entity.find(
      (e) => e.vehicle?.vehicle?.label === "65"
    )!.vehicle!

    expect(vehicle.currentStatus).toBe(
      rt.VehiclePosition.VehicleStopStatus.STOPPED_AT
    )
    expect(vehicle.stopId).toBe("332")
  })

  it("omits the bearing when the tracker reports no heading", () => {
    // Sending 0 for an unknown heading would claim the train faces due north.
    const feed = buildFeeds(edgeCases, NOW).vehiclePositions
    const position = feed.entity.find(
      (e) => e.vehicle?.vehicle?.label === "60"
    )!.vehicle!.position!

    expect(position.bearing).toBeUndefined()
    expect(position.speed).toBeCloseTo(25, 4)
  })

  it("reports lateness from diffMin, with the predicted time alongside", () => {
    // Train 52 at Oshawa: diffMin 8, so delay is 8 * 60 seconds. Its nested
    // arrival estimate is 2026-08-30T09:17:36-04:00.
    const feed = buildFeeds(trains, NOW).tripUpdates
    const update = feed.entity.find((e) => e.id === "52")!.tripUpdate!
    const oshawa = update.stopTimeUpdate!.find((u) => u.stopId === "367")!

    expect(oshawa.arrival!.delay).toBe(480)
    expect(Number(oshawa.arrival!.time)).toBe(1788095856)
  })

  it("suppresses the predicted time when trains 14 and 15 disagree with it", () => {
    // The Ocean's departure slipped a day. Its stops report diffMin 0 while
    // the estimate sits exactly 1440 minutes after the schedule, so the
    // timestamp is a lie and only the delay may be published.
    const feed = buildFeeds(trains, NOW).tripUpdates

    for (const id of ["14", "15"]) {
      const update = feed.entity.find((e) => e.id === id)!.tripUpdate!
      const events = update.stopTimeUpdate!.flatMap((u) =>
        [u.arrival, u.departure].filter((event) => event != null)
      )

      expect(events.length).toBeGreaterThan(0)
      expect(events.every((event) => event.delay === 0)).toBe(true)
      expect(events.every((event) => event.time == null)).toBe(true)
    }
  })

  it("marks a stop with no prediction as NO_DATA rather than guessing", () => {
    // 335 of the 819 stops in this capture carry no estimate at all. Two of
    // them (26/COTO and 602/CHRT) are stops the scheduled trip does not serve,
    // so they are dropped during alignment and never reach the feed.
    const feed = buildFeeds(trains, NOW).tripUpdates
    const updates = feed.entity.flatMap((e) => e.tripUpdate!.stopTimeUpdate!)

    const noData = updates.filter(
      (u) =>
        u.scheduleRelationship ===
        rt.TripUpdate.StopTimeUpdate.ScheduleRelationship.NO_DATA
    )

    expect(noData).toHaveLength(333)
    expect(noData.every((u) => u.arrival == null && u.departure == null)).toBe(
      true
    )
  })

  it("marks a cancelled stop SKIPPED, and a truncated tail not at all", () => {
    const feed = buildFeeds(edgeCases, NOW).tripUpdates
    const update = feed.entity.find((e) => e.id === "62")!.tripUpdate!

    const guildwood = update.stopTimeUpdate!.find((u) => u.stopId === "450")!
    expect(guildwood.scheduleRelationship).toBe(
      rt.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED
    )

    // Trip 450 has more stops than the feed published. The rest are unknown,
    // so the feed says nothing about them at all.
    expect(update.stopTimeUpdate).toHaveLength(3)
  })

  it("dates a trip from its service day and never invents a cancellation", () => {
    // A cancelled train simply disappears from the tracker, which is
    // indistinguishable from one outside the publishing window.
    const feed = buildFeeds(trains, NOW).tripUpdates
    const trip = feed.entity.find((e) => e.id === "52")!.tripUpdate!.trip

    expect(trip.tripId).toBe("516")
    expect(trip.startDate).toBe("20260830")
    expect(trip.scheduleRelationship).toBe(
      rt.TripDescriptor.ScheduleRelationship.SCHEDULED
    )

    const cancelled = feed.entity.filter(
      (e) =>
        e.tripUpdate?.trip.scheduleRelationship ===
        rt.TripDescriptor.ScheduleRelationship.CANCELED
    )
    expect(cancelled).toEqual([])
  })

  it("still locates a train the schedule does not know, without a trip", () => {
    // Seasonal and special services show up in the tracker before the
    // published schedule catches up. A position is still useful; a trip update
    // with no trip to update is not.
    const feeds = buildFeeds(edgeCases, NOW)

    const vehicle = feeds.vehiclePositions.entity.find(
      (e) => e.vehicle?.vehicle?.label === "9999"
    )!.vehicle!
    expect(vehicle.trip).toBeUndefined()
    expect(vehicle.position!.latitude).toBeCloseTo(45, 4)

    expect(
      feeds.tripUpdates.entity.find((e) => e.id === "9999")
    ).toBeUndefined()
  })

  it("publishes each distinct alert once, naming every train it affects", () => {
    // 13 trains carry 15 alerts between them, but only 9 are distinct — the
    // general advisory is repeated verbatim on six trains.
    const feed = buildFeeds(trains, NOW).alerts

    expect(feed.entity).toHaveLength(9)

    const informed = feed.entity.flatMap((e) => e.alert!.informedEntity!)
    expect(informed).toHaveLength(15)

    const advisory = feed.entity.find((e) =>
      e.alert!.headerText!.translation!.some(
        (t) => t.text === "General advisory"
      )
    )!
    expect(advisory.alert!.informedEntity).toHaveLength(6)
  })

  it("carries both official languages and omits an empty url", () => {
    const feed = buildFeeds(trains, NOW).alerts
    const alert = feed.entity[0].alert!

    expect(alert.headerText!.translation!.map((t) => t.language)).toEqual([
      "en",
      "fr",
    ])
    expect(alert.descriptionText!.translation).toHaveLength(2)
    // Every alert in this capture has an empty url, and an empty
    // TranslatedString is worse than no url at all.
    expect(alert.url).toBeUndefined()
  })

  it("reports a replaced stop as modified service", () => {
    const feed = buildFeeds(edgeCases, NOW).alerts
    const alert = feed.entity.find((e) =>
      e.alert!.informedEntity!.some((i) => i.stopId === "367")
    )!.alert!

    expect(alert.effect).toBe(rt.Alert.Effect.MODIFIED_SERVICE)
    expect(alert.informedEntity![0].trip!.tripId).toBe("450")
    expect(alert.descriptionText!.translation![0].text).toContain("651")
  })

  it("decodes HTML entities that leak out of the upstream site", () => {
    const feed = buildFeeds(trains, NOW).alerts
    const texts = feed.entity.flatMap((e) => [
      ...e.alert!.headerText!.translation!.map((t) => t.text),
      ...e.alert!.descriptionText!.translation!.map((t) => t.text),
    ])

    expect(texts.some((t) => t.includes("&"))).toBe(false)
  })

  it("round trips accented French alert text", () => {
    // The bilingual alerts are the only multi-byte text in any feed, and the
    // encoder has to survive it.
    const feed = buildFeeds(trains, NOW).alerts
    const bytes = rt.FeedMessage.encode(feed, new Writer()).finish()
    const decoded = rt.FeedMessage.decode(bytes)

    const french = decoded.entity.flatMap((e) =>
      e.alert!.headerText!.translation!.filter((t) => t.language === "fr")
    )
    expect(french.length).toBeGreaterThan(0)
    expect(french.some((t) => /[àâçéèêîôûù]/i.test(t.text!))).toBe(true)
  })

  it.each([
    ["the live capture", trains],
    ["the edge cases", edgeCases],
  ])("produces feeds that survive a protobuf round trip on %s", (_, input) => {
    const feeds = buildFeeds(input, NOW)

    for (const feed of [
      feeds.tripUpdates,
      feeds.vehiclePositions,
      feeds.alerts,
    ]) {
      expect(rt.FeedMessage.verify(feed)).toBeNull()

      // Encode exactly the way serve.ts does. protobufjs would otherwise pick
      // a Buffer-backed writer that mishandles multi-byte text on Workers.
      const bytes = rt.FeedMessage.encode(feed, new Writer()).finish()
      const decoded = rt.FeedMessage.decode(bytes)
      expect(decoded.entity).toHaveLength(feed.entity.length)

      // Re-encoding what we decoded must reproduce the same bytes, so the
      // published .pb is a stable fixed point rather than a lossy one.
      // (Speed is a protobuf float, so the wire form — not the source
      // object — is the thing that must round trip exactly.)
      expect(rt.FeedMessage.encode(decoded, new Writer()).finish()).toEqual(
        bytes
      )

      // The .json mirror must describe exactly the message the .pb carries.
      expect(toCanonicalJson(decoded)).toEqual(
        toCanonicalJson(rt.FeedMessage.decode(bytes))
      )
    }
  })
})
