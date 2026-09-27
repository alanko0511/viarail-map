/**
 * @vitest-environment jsdom
 *
 * Train search over the real fixture: typing filters by train number, and
 * picking a train navigates to it. Only the route
 * hooks and `use-train-views` are stubbed.
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { TrainSearchCombobox } from "@/components/train-search-combobox"
import type { TrainView } from "@/lib/view-model"
import { toTrainViews } from "@/lib/view-model"
import { buildFeeds, toCanonicalJson } from "@/server/gtfs-rt/build-feed"
import type { AllTrainData } from "@/server/schemas/train"

import fixture from "../../server/__tests__/fixtures/all-train-data-2026-08-30.json"

const router = vi.hoisted(() => ({
  navigate: vi.fn(),
  activeTrainId: undefined as string | undefined,
}))

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => router.navigate,
  useMatch: () =>
    router.activeTrainId
      ? { params: { trainId: router.activeTrainId } }
      : undefined,
}))

const views = vi.hoisted(() => ({ current: new Map<string, TrainView>() }))

vi.mock("@/hooks/use-train-views", () => ({
  useTrainViews: () => views.current,
}))

const NOW = new Date("2026-08-30T15:17:32Z")

beforeAll(() => {
  const feeds = buildFeeds(fixture as unknown as AllTrainData, NOW)
  const list = toTrainViews({
    tripUpdates: toCanonicalJson(feeds.tripUpdates),
    vehiclePositions: toCanonicalJson(feeds.vehiclePositions),
    alerts: toCanonicalJson(feeds.alerts),
  })
  views.current = new Map(list.map((train) => [train.key, train]))
})

afterEach(() => {
  cleanup()
  router.navigate.mockClear()
  router.activeTrainId = undefined
})

// Base UI treats a change without an `inputType` as autofill and keeps the
// popup closed, so this has to look like real typing.
function type(query: string) {
  fireEvent.input(screen.getByRole("combobox"), {
    target: { value: query },
    inputType: "insertText",
  })
}

/** Each listed row as its visible pieces, once the popup has opened. */
async function listedRows() {
  await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy())
  return screen
    .queryAllByRole("option")
    .map((option) =>
      [...option.querySelectorAll("span")]
        .map((span) => span.textContent)
        .filter(Boolean)
    )
}

/** Train numbers listed once the popup has opened. */
async function listedTrains() {
  return (await listedRows()).map((row) => row[0])
}

describe("TrainSearchCombobox", () => {
  it("finds trains whose number starts with the query", async () => {
    render(<TrainSearchCombobox />)

    type("64")

    expect((await listedTrains()).sort()).toEqual([
      "64",
      "643",
      "645",
      "646",
      "647",
    ])
  })

  it("does not search stations", async () => {
    render(<TrainSearchCombobox />)

    type("ottawa")

    expect(await listedTrains()).toEqual([])
    expect(screen.getByText("No trains found.")).toBeTruthy()
  })

  it("shows where each train runs from and to", async () => {
    render(<TrainSearchCombobox />)

    type("646")

    expect(await listedRows()).toEqual([["646", "Toronto → Ottawa"]])
  })

  it("dates the runs of a multi-day train apart", async () => {
    render(<TrainSearchCombobox />)

    type("1")

    // In-service runs sort first, so order says nothing here.
    const rows = (await listedRows()).filter((row) => row.length === 3)
    expect(rows).toHaveLength(2)
    expect(rows).toEqual(
      expect.arrayContaining([
        ["1", "Toronto → Vancouver", "Aug 26"],
        ["1", "Toronto → Vancouver", "Aug 30"],
      ])
    )
  })

  it("lists every train when opened with a train already selected", async () => {
    router.activeTrainId = "646"
    render(<TrainSearchCombobox />)

    const input = screen.getByRole<HTMLInputElement>("combobox")
    expect(input.value).toBe("646")

    // Base UI opens on mousedown rather than click.
    fireEvent.mouseDown(input)

    expect(await listedTrains()).toHaveLength(views.current.size)
  })

  it("navigates to the train that is picked", async () => {
    render(<TrainSearchCombobox />)

    type("646")
    fireEvent.click(await screen.findByRole("option", { name: /646/ }))

    expect(router.navigate).toHaveBeenCalledWith({
      to: "/train/$trainId",
      params: { trainId: "646" },
    })
  })
})
