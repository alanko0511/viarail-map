import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/train/$trainId")({
  component: TrainPage,
})

function TrainPage() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted/30">
      <p className="text-muted-foreground">Map will render here</p>
    </div>
  )
}
