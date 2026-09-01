/**
 * @vitest-environment jsdom
 *
 * What the timeline puts on screen for one stop, driven by a real VIA payload
 * through the real pipeline. Only the two I/O seams are stubbed: the route
 * loader (`use-train-views`) and the third-party consist lookup
 * (`use-train-consist`). Every StopView under test is built by production code.
 *
 * The rendering rules were checked against tsimobile.viarail.ca on 2026-08-31,
 * on trains running that evening; the comments record what VIA showed.
 */
import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { TrainTimeline } from "@/components/train-timeline"
import { formatStopTime } from "@/lib/format-time"
import type { TrainView } from "@/lib/view-model"
import { toTrainViews } from "@/lib/view-model"
import { buildFeeds, toCanonicalJson } from "@/server/gtfs-rt/build-feed"
import type { AllTrainData } from "@/server/schemas/train"

import fixture from "../../server/__tests__/fixtures/all-train-data-2026-08-30.json"

// The consist badge is a traincar.info lookup fired from an effect. It has its
// own tests; here it would only be a network call.
vi.mock("@/hooks/use-train-consist", () => ({
  useTrainConsist: () => ({ summary: null, loading: false }),
}))

const views = vi.hoisted(() => ({ current: new Map<string, TrainView>() }))

vi.mock("@/hooks/use-train-views", () => ({
  useTrainViews: () => views.current,
}))

/** When the fixture was polled, so statuses land where they really did. */
const NOW = new Date("2026-08-30T15:17:32Z")

let trains: Map<string, TrainView>

beforeAll(() => {
  const feeds = buildFeeds(fixture as unknown as AllTrainData, NOW)
  const list = toTrainViews({
    tripUpdates: toCanonicalJson(feeds.tripUpdates),
    vehiclePositions: toCanonicalJson(feeds.vehiclePositions),
    alerts: toCanonicalJson(feeds.alerts),
  })
  trains = new Map(list.map((train) => [train.key, train]))
})

/** Renders one train and returns a reader over its stop blocks, in order. */
function renderTrain(key: string) {
  const train = trains.get(key)
  if (!train) throw new Error(`fixture has no train ${key}`)

  views.current = trains
  const { container } = render(<TrainTimeline trainId={key} />)

  const stops = Array.from(
    container.querySelectorAll<HTMLElement>(".flex.gap-3")
  )

  return {
    train,
    stops,
    /** The stop block carrying a given station code, e.g. "TRTO". */
    byCode(code: string) {
      const found = stops.find((el) => el.textContent?.includes(code))
      if (!found) throw new Error(`${key} has no stop block for ${code}`)
      return found
    },
  }
}

/** The time rows inside one stop block, as {label, scheduled, estimated}. */
function timeRows(stop: HTMLElement) {
  return Array.from(stop.querySelectorAll<HTMLElement>(".items-baseline")).map(
    (row) => {
      const [label, scheduled, estimated] = Array.from(row.children).map(
        (child) => child.textContent?.trim() ?? ""
      )
      // A stop with no prediction renders no third span at all, which is a
      // different fact from an empty one - keep it explicit.
      return {
        label: label.replace(":", ""),
        scheduled,
        estimated: estimated ?? null,
      }
    }
  )
}

afterEach(cleanup)

describe("TrainTimeline stop times", () => {
  it("shows the departure at the origin, which has no arrival", () => {
    // The regression: an origin's dwell is undefined, so gating the departure
    // row on `showDwell` alone left the first stop with no times at all. VIA
    // prints the origin's departure under an "arrival" heading; we label it
    // for what it is.
    const { byCode } = renderTrain("1 (08-26)")

    expect(timeRows(byCode("TRTO"))).toEqual([
      {
        label: "Departure",
        scheduled: "9:55 a.m.",
        estimated: "(Est: 11:55 a.m.)",
      },
    ])
  })

  it("shows the arrival at the destination, and no departure", () => {
    // The mirror case: a train does not depart where it terminates.
    const { byCode } = renderTrain("24")

    expect(timeRows(byCode("QBEC"))).toEqual([
      {
        label: "Arrival",
        scheduled: "4:12 p.m.",
        estimated: "(Est: 4:12 p.m.)",
      },
    ])
  })

  it("gives every stop of every train at least one time row", () => {
    // The invariant the origin bug broke, stated over all 64 trains in the
    // fixture so a future gate cannot silently blank a stop shape nobody
    // thought to name.
    for (const key of trains.keys()) {
      const { stops, train } = renderTrain(key)

      expect(stops).toHaveLength(train.stops.length)
      for (const [i, stop] of stops.entries()) {
        expect(
          timeRows(stop).length,
          `${key} stop ${i} (${train.stops[i].code}) rendered no time`
        ).toBeGreaterThan(0)
      }
      cleanup()
    }
  })

  it("shows both rows where the train genuinely waits", () => {
    // Smithers is a 10 minute servicing stop on the Prince Rupert run. VIA
    // prints it as a two line cell, "17h10 (Arr.) / 17h20 (Dep.)".
    const { byCode } = renderTrain("6")

    expect(timeRows(byCode("SMTR"))).toEqual([
      {
        label: "Arrival",
        scheduled: "2:14 p.m.",
        estimated: "(Est: 2:22 p.m.)",
      },
      {
        label: "Departure",
        scheduled: "2:24 p.m.",
        estimated: "(Est: 2:32 p.m.)",
      },
    ])
  })

  it("keeps a five minute pause to one row, as VIA does", () => {
    // Terrace is 5 minutes and VIA prints a single line there while printing
    // two for Smithers, so the 7 minute threshold is not arbitrary: it lands
    // on the same side as the operator for both.
    const { byCode } = renderTrain("6")

    expect(timeRows(byCode("TRRC"))).toEqual([
      {
        label: "Arrival",
        scheduled: "10:20 a.m.",
        estimated: "(Est: 10:28 a.m.)",
      },
    ])
  })

  it("renders an overnight layover without wrapping the clock", () => {
    // Train 5 lies over at Prince George: in at 5:08 p.m., away at 8:00 a.m.
    // the next morning. The departure must read as the morning time rather
    // than folding back into the arrival's day.
    const { byCode, train } = renderTrain("5")

    expect(timeRows(byCode("PGEO"))).toEqual([
      { label: "Arrival", scheduled: "5:08 p.m.", estimated: null },
      { label: "Departure", scheduled: "8:00 a.m.", estimated: null },
    ])

    const pgeo = train.stops.find((stop) => stop.code === "PGEO")!
    const layoverHours =
      (pgeo.departure!.scheduled.getTime() -
        pgeo.arrival!.scheduled.getTime()) /
      3_600_000
    expect(layoverHours).toBeGreaterThan(12)
  })

  it("does not mistake a truncated first stop for an origin", () => {
    // VIA published train 43 from Fallowfield, short of its Ottawa origin.
    // Fallowfield is mid-route, so it keeps its arrival and renders as one
    // row. A fix keyed on the array index rather than on the absent arrival
    // would print a departure here instead.
    const { byCode, train } = renderTrain("43")

    expect(train.stopsAreTruncated).toBe(true)
    expect(train.stops[0].code).toBe("FALL")
    expect(timeRows(byCode("FALL"))).toEqual([
      {
        label: "Arrival",
        scheduled: "9:52 a.m.",
        estimated: "(Est: 9:54 a.m.)",
      },
    ])
  })

  it("omits the estimate when the feed withheld one", () => {
    // Harvey is a flag stop the tracker predicts nothing for. VIA prints an em
    // dash in its expected column; we print the scheduled time alone rather
    // than an empty bracket.
    const { byCode } = renderTrain("5")

    const row = byCode("HRVY").querySelector(".items-baseline")!
    expect(row.textContent).toContain("11:38 a.m.")
    expect(row.textContent).not.toContain("Est")
  })

  it("prints a scheduled departure that has no prediction", () => {
    // Niagara Falls is where 97 becomes 64, so GTFS gives it a real departure
    // 8 minutes after arrival while the tracker, which ends its list there,
    // predicts nothing for it. Both facts have to survive to the screen.
    const { byCode } = renderTrain("97")

    expect(timeRows(byCode("NIAG"))).toEqual([
      {
        label: "Arrival",
        scheduled: "10:20 a.m.",
        estimated: "(Est: 10:20 a.m.)",
      },
      { label: "Departure", scheduled: "10:28 a.m.", estimated: null },
    ])
  })

  it("shows a prediction that runs ahead of the schedule", () => {
    // Train 50 reaches Guildwood a minute early. An early train is still a
    // prediction and still prints.
    const { byCode, train } = renderTrain("50")

    expect(train.stops.find((stop) => stop.code === "GUIL")!.delayMinutes).toBe(
      -1
    )
    expect(timeRows(byCode("GUIL"))).toEqual([
      {
        label: "Arrival",
        scheduled: "6:50 a.m.",
        estimated: "(Est: 6:48 a.m.)",
      },
    ])
  })

  it("renders each stop in its own timezone, not one clock for the train", () => {
    // The Canadian runs through five zones. A stop's time is the time on the
    // platform there, so Vancouver must print in Pacific even though the train
    // and the rest of the list started in Eastern.
    const { byCode, train } = renderTrain("1 (08-26)")

    expect(new Set(train.stops.map((stop) => stop.timezone)).size).toBe(5)

    const vancouver = train.stops.at(-1)!
    expect(vancouver.code).toBe("VCVR")
    expect(vancouver.timezone).toBe("America/Vancouver")

    const [printed] = timeRows(byCode("VCVR"))
    const instant = vancouver.arrival!.scheduled
    expect(printed.scheduled).toBe(formatStopTime(instant, "America/Vancouver"))
    // The same instant read off a Toronto clock is a different hour, so the
    // assertion above is about the timezone and not a coincidence.
    expect(printed.scheduled).not.toBe(
      formatStopTime(instant, "America/Toronto")
    )
  })

  it("keeps a cross-border stop on its own side of the clock", () => {
    // Niagara Falls is America/New_York on a Canadian train.
    const { train } = renderTrain("97")

    expect(train.stops.at(-1)!.timezone).toBe("America/New_York")
  })
})

describe("TrainTimeline stop annotations", () => {
  it("badges a late stop and leaves an on-time one bare", () => {
    const late = renderTrain("1 (08-26)")
    expect(within(late.byCode("TRTO")).getByText("+120M")).toBeTruthy()

    cleanup()

    const onTime = renderTrain("24")
    expect(within(onTime.byCode("QBEC")).queryByText(/^\+\d+M$/)).toBeNull()
  })

  it("keeps the station code under every stop", () => {
    const { stops, train } = renderTrain("2 (08-28)")

    for (const [i, stop] of stops.entries()) {
      expect(stop.textContent).toContain(train.stops[i].code)
    }
  })

  it("renders the alert VIA published for the train", () => {
    renderTrain("14")

    expect(
      screen.getByText("Train 14 of August 30th - Postponed departure")
    ).toBeTruthy()
  })

  it("says so when VIA publishes only part of the stop list", () => {
    renderTrain("43")

    expect(
      screen.getByText(/VIA publishes only part of this train's stop list/)
    ).toBeTruthy()
  })

  it("stays quiet when the stop list is complete", () => {
    renderTrain("24")

    expect(
      screen.queryByText(/VIA publishes only part of this train's stop list/)
    ).toBeNull()
  })

  it("reports a train the feed does not carry", () => {
    views.current = trains
    render(<TrainTimeline trainId="404" />)

    expect(screen.getByText("Train not found.")).toBeTruthy()
  })
})
