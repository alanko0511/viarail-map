import type { FeatureCollection } from "geojson"

import canadian from "./viarail/canadian.json"
import churchill from "./viarail/churchill.json"
import corridor from "./viarail/corridor.json"
import jonquiere from "./viarail/jonquiere.json"
import ocean from "./viarail/ocean.json"
import rupert from "./viarail/rupert.json"
import senneterre from "./viarail/senneterre.json"
import whiteriver from "./viarail/whiteriver.json"

const collections = [
  canadian,
  corridor,
  ocean,
  churchill,
  jonquiere,
  senneterre,
  rupert,
  whiteriver,
] as unknown as Array<FeatureCollection>

export const routeGeometry: FeatureCollection = {
  type: "FeatureCollection",
  features: collections.flatMap((c) => c.features),
}
