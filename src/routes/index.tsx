import { createFileRoute } from "@tanstack/react-router"
import { TrainMap } from "@/components/map"

export const Route = createFileRoute("/")({ component: MapPage })

function MapPage() {
  return <TrainMap />
}
