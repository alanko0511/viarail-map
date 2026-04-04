import { createFileRoute } from "@tanstack/react-router"
import { TrainMap } from "@/components/map"

export const Route = createFileRoute("/train/$trainId")({
  component: TrainPage,
})

function TrainPage() {
  return <TrainMap />
}
