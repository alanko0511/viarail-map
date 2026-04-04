import { useCallback, useEffect, useRef, useState } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { layers, namedFlavor } from "@protomaps/basemaps"
import Map, { Layer, Marker, Source } from "react-map-gl/maplibre"
import type { MapRef } from "react-map-gl/maplibre"
import type { FilterSpecification } from "maplibre-gl"
import type { FeatureCollection } from "geojson"
import { useNavigate, useRouter } from "@tanstack/react-router"
import { Route as RootRoute } from "@/routes/__root"
import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/ui/sidebar"
import { ArrowUp, LocateFixed, LocateOff } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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
      url: "/tiles/ca.json",
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
  const [following, setFollowing] = useState(false)
  const mapRef = useRef<MapRef>(null)
  const prevTrainIdRef = useRef<string | undefined>(undefined)
  const trainData = RootRoute.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()
  const { setOpen, setOpenMobile, isMobile } = useSidebar()

  useEffect(() => {
    setIsClient(true)
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

  useEffect(() => {
    const interval = setInterval(() => router.invalidate(), 10_000)
    return () => clearInterval(interval)
  }, [router])

  // When activeTrainId changes, fly to the train and enable follow
  useEffect(() => {
    if (!activeTrainId || activeTrainId === prevTrainIdRef.current) return
    prevTrainIdRef.current = activeTrainId

    const train = trainData[activeTrainId]
    if (train?.lat == null || train?.lng == null) return

    mapRef.current?.flyTo({ center: [train.lng, train.lat], zoom: 8 })
    setFollowing(true)
  }, [activeTrainId, trainData])

  // When following and train data updates, keep centering on the train
  useEffect(() => {
    if (!following || !activeTrainId) return
    const train = trainData[activeTrainId]
    if (train?.lat == null || train?.lng == null) return

    mapRef.current?.easeTo({ center: [train.lng, train.lat], duration: 500 })
  }, [following, trainData, activeTrainId])

  // Disable follow when user interacts with the map
  const handleMoveStart = useCallback(
    (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) {
        setFollowing(false)
      }
    },
    [],
  )

  const handleToggleFollow = useCallback(() => {
    setFollowing((prev) => {
      const next = !prev
      if (next && activeTrainId) {
        const train = trainData[activeTrainId]
        if (train?.lat != null && train?.lng != null) {
          mapRef.current?.flyTo({ center: [train.lng, train.lat], zoom: 8 })
        }
      }
      return next
    })
  }, [activeTrainId, trainData])

  if (!isClient) {
    return <div className="h-full w-full bg-[#000000]" />
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={{
        longitude: -96,
        latitude: 56,
        zoom: 4,
      }}
      style={{ width: "100%", height: "100%" }}
      maxBounds={[-143.789063, 40.313043, -50.273438, 83.753911]}
      mapStyle={mapStyle}
      onMoveStart={handleMoveStart}
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
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="xs"
                    className="shadow-md"
                    style={{
                      ...(trainId === activeTrainId && {
                        backgroundColor: ACTIVE_COLOR,
                        borderColor: ACTIVE_COLOR,
                      }),
                    }}
                    onClick={() => {
                      if (trainId === activeTrainId) {
                        mapRef.current?.flyTo({
                          center: [train.lng!, train.lat!],
                        })
                        setFollowing(true)
                      } else {
                        navigate({
                          to: "/train/$trainId",
                          params: { trainId },
                        })
                        if (isMobile) {
                          setOpenMobile(true)
                        } else {
                          setOpen(true)
                        }
                      }
                    }}
                  />
                }
              >
                {trainNumber}
                {train.direction != null && (
                  <ArrowUp
                    className="size-3"
                    style={{ transform: `rotate(${train.direction}deg)` }}
                  />
                )}
              </TooltipTrigger>
              {train.speed != null && (
                <TooltipContent>{train.speed} km/h</TooltipContent>
              )}
            </Tooltip>
          </Marker>
        )
      })}
      {activeTrainId && (
        <div className="absolute bottom-6 left-3 z-10">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon"
                  variant={following ? "default" : "outline"}
                  className="size-8 shadow-md"
                  onClick={handleToggleFollow}
                />
              }
            >
              {following ? (
                <LocateFixed className="size-4" />
              ) : (
                <LocateOff className="size-4" />
              )}
            </TooltipTrigger>
            <TooltipContent side="right">
              {following ? "Following train" : "Follow train"}
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </Map>
  )
}
