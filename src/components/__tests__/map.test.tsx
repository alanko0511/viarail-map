/**
 * @vitest-environment jsdom
 *
 * A train deep link must centre the map on that train once the map is ready,
 * even though the map mounts (and loads) after the first render. MapLibre is
 * stubbed with a `Map` that exposes `flyTo`/`easeTo` spies through its ref and
 * lets the test fire `onLoad` when it chooses.
 */
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { TrainMap } from "@/components/map"
import type { TrainView } from "@/lib/view-model"
import { toTrainViews } from "@/lib/view-model"
import { buildFeeds, toCanonicalJson } from "@/server/gtfs-rt/build-feed"
import type { AllTrainData } from "@/server/schemas/train"

import fixture from "../../server/__tests__/fixtures/all-train-data-2026-08-30.json"

const mapStub = vi.hoisted(() => ({
  flyTo: vi.fn(),
  easeTo: vi.fn(),
  onLoad: null as (() => void) | null,
}))

vi.mock("react-map-gl/maplibre", async () => {
  const { forwardRef, useImperativeHandle } = await import("react")
  const MapMock = forwardRef(function Map(
    props: { onLoad?: () => void; children?: React.ReactNode },
    ref
  ) {
    useImperativeHandle(ref, () => ({
      flyTo: mapStub.flyTo,
      easeTo: mapStub.easeTo,
    }))
    mapStub.onLoad = props.onLoad ?? null
    return <div data-testid="map">{props.children}</div>
  })
  return {
    default: MapMock,
    GeolocateControl: forwardRef(function GeolocateControl() {
      return null
    }),
    Layer: () => null,
    Marker: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    Source: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  }
})

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock("@/components/ui/sidebar", () => ({
  useSidebar: () => ({
    setOpen: vi.fn(),
    setOpenMobile: vi.fn(),
    isMobile: false,
  }),
}))

const views = vi.hoisted(() => ({ current: new Map<string, TrainView>() }))

vi.mock("@/hooks/use-train-views", () => ({
  useTrainViews: () => views.current,
}))

const NOW = new Date("2026-08-30T15:17:32Z")

let trains: Map<string, TrainView>

beforeAll(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {}))
  )
  const feeds = buildFeeds(fixture as unknown as AllTrainData, NOW)
  const list = toTrainViews({
    tripUpdates: toCanonicalJson(feeds.tripUpdates),
    vehiclePositions: toCanonicalJson(feeds.vehiclePositions),
    alerts: toCanonicalJson(feeds.alerts),
  })
  trains = new Map(list.map((train) => [train.key, train]))
})

afterEach(() => {
  cleanup()
  mapStub.flyTo.mockClear()
  mapStub.easeTo.mockClear()
  mapStub.onLoad = null
})

function trainWithPosition() {
  const train = [...trains.values()].find((t) => t.position)
  if (!train?.position) throw new Error("fixture has no train with a position")
  return { key: train.key, position: train.position }
}

describe("TrainMap with a preselected train", () => {
  it("flies to the train once the map has loaded", () => {
    const { key, position } = trainWithPosition()
    views.current = trains

    render(<TrainMap activeTrainId={key} />)

    // Map is mounted but not yet loaded: nothing should have moved.
    expect(mapStub.onLoad).not.toBeNull()
    expect(mapStub.flyTo).not.toHaveBeenCalled()

    act(() => mapStub.onLoad?.())

    expect(mapStub.flyTo).toHaveBeenCalledTimes(1)
    expect(mapStub.flyTo).toHaveBeenCalledWith({
      center: [position.lng, position.lat],
      zoom: 8,
    })
  })

  it("waits for the train's position to arrive before flying", () => {
    const { key, position } = trainWithPosition()
    views.current = new Map()

    const { rerender } = render(<TrainMap activeTrainId={key} />)
    act(() => mapStub.onLoad?.())

    expect(mapStub.flyTo).not.toHaveBeenCalled()

    views.current = trains
    rerender(<TrainMap activeTrainId={key} />)

    expect(mapStub.flyTo).toHaveBeenCalledTimes(1)
    expect(mapStub.flyTo).toHaveBeenCalledWith({
      center: [position.lng, position.lat],
      zoom: 8,
    })
  })

  it("does not fly again on later feed refreshes", () => {
    const { key } = trainWithPosition()
    views.current = trains

    const { rerender } = render(<TrainMap activeTrainId={key} />)
    act(() => mapStub.onLoad?.())
    expect(mapStub.flyTo).toHaveBeenCalledTimes(1)

    views.current = new Map(trains)
    rerender(<TrainMap activeTrainId={key} />)

    expect(mapStub.flyTo).toHaveBeenCalledTimes(1)
    // Follow mode keeps easing instead.
    expect(mapStub.easeTo).toHaveBeenCalled()
  })
})
