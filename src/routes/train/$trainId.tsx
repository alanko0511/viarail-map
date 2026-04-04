import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/train/$trainId")({
  component: () => null,
})
