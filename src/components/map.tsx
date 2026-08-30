import { useNavigate } from "@tanstack/react-router"
import type { FeatureCollection } from "geojson"
import { ArrowUp, TrainFront } from "lucide-react"

import "maplibre-gl/dist/maplibre-gl.css"
import { useCallback, useEffect, useRef, useState } from "react"
import Map, {
  GeolocateControl,
  Layer,
  Marker,
  Source,
} from "react-map-gl/maplibre"
import type {
  GeolocateControlInstance,
  LayerProps,
  MapRef,
} from "react-map-gl/maplibre"

import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { stops as gtfsStops } from "@/data/gtfs"
import { useAutoGeolocate } from "@/hooks/use-auto-geolocate"
import { useTrainViews } from "@/hooks/use-train-views"

const PRIMARY_COLOR = "#efb100"

const MAP_STYLE_URL =
  "https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json"

const lineLayer: LayerProps = {
  id: "train-lines",
  type: "line",
  paint: {
    "line-color": PRIMARY_COLOR,
    "line-width": 4,
  },
  layout: {
    "line-join": "round",
    "line-cap": "round",
  },
}

/**
 * `rank` is how many trips call at a stop. VIA's GTFS has no notion of a major
 * station, so prominence is derived from how much service a stop actually
 * sees: busy stations show up first and stay largest as you zoom out.
 */
const stationCircleLayer: LayerProps = {
  id: "station-circles",
  type: "circle",
  paint: {
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      4,
      ["case", [">=", ["get", "rank"], 10], 4, 0],
      8,
      ["case", [">=", ["get", "rank"], 10], 6, 3],
      11,
      6,
    ],
    "circle-color": PRIMARY_COLOR,
    "circle-stroke-width": 1,
    "circle-stroke-color": "#555555",
  },
}

const stationLabelLayer: LayerProps = {
  id: "station-labels",
  type: "symbol",
  minzoom: 5,
  filter: [
    "step",
    ["zoom"],
    [">=", ["get", "rank"], 20],
    7,
    [">=", ["get", "rank"], 8],
    9,
    true,
  ],
  layout: {
    "text-field": ["get", "name"],
    "text-font": ["Noto Sans Regular"],
    "text-size": ["interpolate", ["linear"], ["get", "rank"], 1, 11, 30, 14],
    "text-offset": [0, -0.8],
    "text-anchor": "bottom",
  },
  paint: {
    "text-color": "#ffffff",
    "text-halo-color": "#555555",
    "text-halo-width": 1,
  },
}

/** Station points, built once from the bundled GTFS stop table. */
const stationData: FeatureCollection = {
  type: "FeatureCollection",
  features: gtfsStops.map((stop) => ({
    type: "Feature",
    properties: { name: stop.name, code: stop.code, rank: stop.rank },
    geometry: { type: "Point", coordinates: [stop.lon, stop.lat] },
  })),
}

const ACTIVE_COLOR = "#fcc800"

export function TrainMap({ activeTrainId }: { activeTrainId?: string }) {
  const [isClient, setIsClient] = useState(false)
  const [routeData, setRouteData] = useState<FeatureCollection | null>(null)
  const [following, setFollowing] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const mapRef = useRef<MapRef>(null)
  const geolocateControlRef = useRef<GeolocateControlInstance>(null)
  const prevTrainIdRef = useRef<string | undefined>(undefined)
  const trains = useTrainViews()
  const navigate = useNavigate()
  const { setOpen, setOpenMobile, isMobile } = useSidebar()

  useEffect(() => {
    setIsClient(true)
  }, [])

  useAutoGeolocate({
    enabled: mapLoaded,
    skip: activeTrainId != null,
    geolocateControlRef,
  })

  // 184 KB of line geometry, served as a static file so its cache lifetime is
  // independent of the JS bundle.
  useEffect(() => {
    fetch("/gtfs/shapes.geojson")
      .then((response) => response.json() as Promise<FeatureCollection>)
      .then(setRouteData)
      .catch(() => setRouteData(null))
  }, [])

  // When activeTrainId changes, fly to the train and enable follow
  useEffect(() => {
    if (!activeTrainId || activeTrainId === prevTrainIdRef.current) return
    prevTrainIdRef.current = activeTrainId

    const position = trains.get(activeTrainId)?.position
    if (!position) return

    mapRef.current?.flyTo({ center: [position.lng, position.lat], zoom: 8 })
    setFollowing(true)
  }, [activeTrainId, trains])

  // When following and train data updates, keep centering on the train
  useEffect(() => {
    if (!following || !activeTrainId) return
    const position = trains.get(activeTrainId)?.position
    if (!position) return

    mapRef.current?.easeTo({
      center: [position.lng, position.lat],
      duration: 500,
    })
  }, [following, trains, activeTrainId])

  // Disable follow when user interacts with the map
  const handleMoveStart = useCallback((e: { originalEvent?: unknown }) => {
    if (e.originalEvent) {
      setFollowing(false)
    }
  }, [])

  const handleToggleFollow = useCallback(() => {
    setFollowing((prev) => {
      const next = !prev
      if (next && activeTrainId) {
        const position = trains.get(activeTrainId)?.position
        if (position) {
          mapRef.current?.flyTo({
            center: [position.lng, position.lat],
            zoom: 8,
          })
        }
      }
      return next
    })
  }, [activeTrainId, trains])

  if (!isClient) {
    return <div className="h-full w-full bg-[#333333]" />
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={{
        longitude: -79.38032,
        latitude: 43.64481,
        zoom: 9,
      }}
      style={{ width: "100%", height: "100%" }}
      maxBounds={[-143.789063, 40.313043, -50.273438, 83.753911]}
      mapStyle={MAP_STYLE_URL}
      onMoveStart={handleMoveStart}
      onLoad={() => setMapLoaded(true)}
    >
      <GeolocateControl
        ref={geolocateControlRef}
        position="top-right"
        positionOptions={{
          enableHighAccuracy: false,
          timeout: 6000,
          maximumAge: 60_000,
        }}
        fitBoundsOptions={{ maxZoom: 9 }}
      />
      {routeData && (
        <Source id="train-routes" type="geojson" data={routeData}>
          <Layer {...lineLayer} />
        </Source>
      )}
      <Source id="stations" type="geojson" data={stationData}>
        <Layer {...stationCircleLayer} />
        <Layer {...stationLabelLayer} />
      </Source>
      {[...trains.values()].map((train) => {
        const { position } = train
        if (!position) return null
        const trainId = train.key
        return (
          <Marker
            key={trainId}
            longitude={position.lng}
            latitude={position.lat}
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
                          center: [position.lng, position.lat],
                        })
                        setFollowing(true)
                      } else {
                        navigate({
                          to: "/train/$trainId",
                          params: { trainId },
                        })
                      }
                      if (isMobile) {
                        setOpenMobile(true)
                      } else {
                        setOpen(true)
                      }
                    }}
                  />
                }
              >
                {train.number}
                {position.bearing != null && (
                  <ArrowUp
                    className="size-3"
                    style={{ transform: `rotate(${position.bearing}deg)` }}
                  />
                )}
              </TooltipTrigger>
              <TooltipContent>
                {Math.round(position.speedKmh)} km/h
              </TooltipContent>
            </Tooltip>
          </Marker>
        )
      })}
      {activeTrainId && (
        <div className="absolute bottom-2.5 left-2.5 z-10">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon"
                  variant={following ? "default" : "secondary"}
                  className="size-8 shadow-md"
                  onClick={handleToggleFollow}
                />
              }
            >
              <TrainFront className="size-4" />
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
