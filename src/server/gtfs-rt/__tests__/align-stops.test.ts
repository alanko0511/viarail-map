import { describe, expect, it } from "vitest"

import { stopTimes } from "@/data/gtfs"
import { alignStops } from "@/server/gtfs-rt/align-stops"
import type { AllTrainData } from "@/server/schemas/train"

import fixture from "../../__tests__/fixtures/all-train-data-2026-08-30.json"

const trains = fixture as unknown as AllTrainData

describe("alignStops", () => {
  it("maps every feed stop to its scheduled stop_id and sequence", () => {
    // Train 52 is trip 516; its 10 feed stops match the trip exactly.
    // stop_times.txt: sequence 1 of trip 516 is stop_id 119 (Toronto).
    const result = alignStops(trains["52"].times, stopTimes["516"])

    expect(result.aligned).toHaveLength(10)
    expect(result.dropped).toEqual([])
    expect(result.aligned[0].stopId).toBe("119")
    expect(result.aligned[0].stopSequence).toBe(1)
    expect(result.aligned[1].stopId).toBe("450") // GUIL, sequence 2
    expect(result.aligned[1].stopSequence).toBe(2)
  })

  it("aligns a truncated stop list without inventing the missing tail", () => {
    // The Canadian publishes a moving window: 25 of trip 112's 67 stops.
    // The 42 it omits are unknown, not skipped, so nothing is dropped.
    const result = alignStops(trains["2 (08-28)"].times, stopTimes["112"])

    expect(stopTimes["112"]).toHaveLength(67)
    expect(result.aligned).toHaveLength(25)
    expect(result.dropped).toEqual([])
  })

  it("aligns a feed that omits the head of the trip", () => {
    // Train 43 is trip 485, which starts at Ottawa. The feed picks it up at
    // Fallowfield, so its first stop is sequence 2, not 1.
    const result = alignStops(trains["43"].times, stopTimes["485"])

    expect(result.aligned).toHaveLength(4)
    expect(result.dropped).toEqual([])
    expect(result.aligned[0].stopId).toBe("576") // FALL
    expect(result.aligned[0].stopSequence).toBe(2)
  })

  it("drops a feed stop the scheduled trip does not serve", () => {
    // Train 602's feed calls at CHRT, which is absent from trip 538.
    const result = alignStops(trains["602"].times, stopTimes["538"])

    expect(result.aligned).toHaveLength(43)
    expect(result.dropped.map((stop) => stop.code)).toEqual(["CHRT"])

    const sequences = result.aligned.map((stop) => stop.stopSequence)
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b))
    expect(new Set(sequences).size).toBe(sequences.length)
  })
})
