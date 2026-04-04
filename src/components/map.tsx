import { useEffect, useState } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { Protocol } from "pmtiles"
import { layers, namedFlavor } from "@protomaps/basemaps"
import Map, { Layer, Marker, Source } from "react-map-gl/maplibre"
import type { FilterSpecification } from "maplibre-gl"
import type { FeatureCollection } from "geojson"
import { useNavigate } from "@tanstack/react-router"
import { Route as RootRoute } from "@/routes/__root"
import { Button } from "@/components/ui/button"
import { ArrowUp } from "lucide-react"

const PRIMARY_COLOR = "#efb100"

const ROUTE_FILES = [
  "canadian",
  "corridor",
  "ocean",
  "churchill",
  "jonquiere",
  "senneterre",
  "rupert",
  "whiteriver",
]

const mapStyle: maplibregl.StyleSpecification = {
  version: 8,
  glyphs:
    "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
  sprite: "https://protomaps.github.io/basemaps-assets/sprites/v4/black",
  sources: {
    protomaps: {
      type: "vector",
      url: "pmtiles://https://build.protomaps.com/20260404.pmtiles",
      attribution:
        '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
    },
  },
  layers: layers("protomaps", namedFlavor("black"), { lang: "en" }),
}

const lineLayer = {
  id: "train-lines",
  type: "line" as const,
  filter: ["==", ["get", "type"], "alignment"] as FilterSpecification,
  paint: {
    "line-color": PRIMARY_COLOR,
    "line-width": 4,
  },
  layout: {
    "line-join": "round" as const,
    "line-cap": "round" as const,
  },
}

const stationCircleLayer = {
  id: "station-circles",
  type: "circle" as const,
  filter: ["==", ["get", "type"], "station-label"] as FilterSpecification,
  paint: {
    "circle-radius": 6,
    "circle-color": PRIMARY_COLOR,
    "circle-stroke-width": 1,
    "circle-stroke-color": "#555555",
  },
}

const stationLabelLayer = {
  id: "station-labels",
  type: "symbol" as const,
  filter: ["==", ["get", "type"], "station-label"] as FilterSpecification,
  layout: {
    "text-field": ["get", "name"] as ["get", string],
    "text-font": ["Noto Sans Regular"],
    "text-size": 12,
    "text-offset": [0, -0.8] as [number, number],
    "text-anchor": "bottom" as const,
  },
  paint: {
    "text-color": "#ffffff",
    "text-halo-color": "#555555",
    "text-halo-width": 1,
  },
}

const ACTIVE_COLOR = "#fcc800"

export function TrainMap({ activeTrainId }: { activeTrainId?: string }) {
  const [isClient, setIsClient] = useState(false)
  const [routeData, setRouteData] = useState<FeatureCollection | null>(null)
  const trainData = RootRoute.useLoaderData()
  const navigate = useNavigate()

  useEffect(() => {
    const protocol = new Protocol()
    maplibregl.addProtocol("pmtiles", protocol.tile)
    setIsClient(true)

    return () => {
      maplibregl.removeProtocol("pmtiles")
    }
  }, [])

  useEffect(() => {
    Promise.all(
      ROUTE_FILES.map((name) =>
        fetch(`/viarail/${name}.json`).then((r) => r.json()),
      ),
    ).then((collections: FeatureCollection[]) => {
      const merged: FeatureCollection = {
        type: "FeatureCollection",
        features: collections.flatMap((c) => c.features),
      }
      setRouteData(merged)
    })
  }, [])

  if (!isClient) {
    return <div className="h-full w-full bg-[#000000]" />
  }

  return (
    <Map
      initialViewState={{
        longitude: -96,
        latitude: 56,
        zoom: 4,
      }}
      style={{ width: "100%", height: "100%" }}
      mapStyle={mapStyle}
    >
      {routeData && (
        <Source id="train-routes" type="geojson" data={routeData}>
          <Layer {...lineLayer} />
          <Layer {...stationCircleLayer} />
          <Layer {...stationLabelLayer} />
        </Source>
      )}
      {Object.entries(trainData).map(([trainId, train]) => {
        if (train.lat == null || train.lng == null) return null
        const trainNumber = trainId.split(" ")[0]
        return (
          <Marker
            key={trainId}
            longitude={train.lng}
            latitude={train.lat}
            anchor="center"
            style={{
              zIndex: trainId === activeTrainId ? 1 : 0,
            }}
          >
            <Button
              size="xs"
              className="shadow-md"
              style={{
                ...(trainId === activeTrainId && {
                  backgroundColor: ACTIVE_COLOR,
                  borderColor: ACTIVE_COLOR,
                }),
              }}
              onClick={() =>
                navigate({ to: "/train/$trainId", params: { trainId } })
              }
            >
              {trainNumber}
              {train.direction != null && (
                <ArrowUp
                  className="size-3"
                  style={{ transform: `rotate(${train.direction}deg)` }}
                />
              )}
            </Button>
          </Marker>
        )
      })}
    </Map>
  )
}
