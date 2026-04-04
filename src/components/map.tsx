import { useEffect, useState } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { Protocol } from "pmtiles"
import { layers, namedFlavor } from "@protomaps/basemaps"
import Map from "react-map-gl/maplibre"

const mapStyle: maplibregl.StyleSpecification = {
  version: 8,
  glyphs:
    "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
  sprite:
    "https://protomaps.github.io/basemaps-assets/sprites/v4/black",
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

export function TrainMap() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    const protocol = new Protocol()
    maplibregl.addProtocol("pmtiles", protocol.tile)
    setIsClient(true)

    return () => {
      maplibregl.removeProtocol("pmtiles")
    }
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
    />
  )
}
