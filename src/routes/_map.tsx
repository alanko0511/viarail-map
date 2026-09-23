import { Outlet, createFileRoute } from "@tanstack/react-router"

import { AppSidebar } from "@/components/app-sidebar"
import { TrainMap } from "@/components/map"
import { MobileTrainBar } from "@/components/mobile-train-bar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useActiveTrainId } from "@/hooks/use-active-train-id"
import { useIsMobile } from "@/hooks/use-mobile"
import type { CanonicalFeeds } from "@/lib/view-model"
import { getFeeds } from "@/server/gtfs-rt/feeds"

/** The last feeds that loaded. A failed poll keeps showing these rather than
 * clearing every train off the map until the next one succeeds. */
let lastFeeds: CanonicalFeeds = {
  tripUpdates: {},
  vehiclePositions: {},
  alerts: {},
}

export const Route = createFileRoute("/_map")({
  // The map needs a browser to draw anything, and its data is stale within
  // seconds, so there is nothing worth rendering on the server. Keeping the
  // live feed off the server also means /gtfs never touches VIA.
  ssr: false,
  loader: async () => {
    try {
      lastFeeds = await getFeeds()
    } catch {
      // Keep the previous poll's data; the next poll retries.
    }
    return { feeds: lastFeeds }
  },
  component: MapLayout,
})

function MapLayout() {
  const isMobile = useIsMobile()
  const activeTrainId = useActiveTrainId()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <div className="relative flex h-full flex-1 flex-col">
          <SidebarTrigger className="absolute top-2 left-2 z-10 max-md:hidden" />
          {isMobile && <MobileTrainBar trainId={activeTrainId} />}
          <div className="flex-1">
            <TrainMap activeTrainId={activeTrainId} />
          </div>
        </div>
      </SidebarInset>
      <Outlet />
    </SidebarProvider>
  )
}
