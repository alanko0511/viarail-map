import { createFileRoute } from "@tanstack/react-router"

import { serveFeed } from "@/server/gtfs-rt/serve"

// One param route rather than six files: a dot is a path separator in the
// flat route convention, so "vehicle-positions.pb" cannot be a filename.
export const Route = createFileRoute("/gtfs-rt/$feed")({
  server: {
    handlers: {
      GET: ({ params }) => serveFeed(params.feed),
    },
  },
})
