import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"
import { configure } from "onedollarstats"
import { useEffect } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { TrainMap } from "@/components/map"
import { MobileTrainBar } from "@/components/mobile-train-bar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useActiveTrainId } from "@/hooks/use-active-train-id"
import { useIsMobile } from "@/hooks/use-mobile"
import { getTrainData } from "@/server/trains"

import appCss from "../styles.css?url"

export const Route = createRootRoute({
  loader: async () => {
    try {
      return {
        trainData: await getTrainData({
          data: { timeZone: "America/Toronto" },
        }),
      }
    } catch {
      return { trainData: {} as Record<string, never> }
    }
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "VIA Rail Map",
      },
    ],
    links: [
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/icon.svg",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootLayout() {
  useEffect(() => {
    configure({
      trackLocalhostAs: "viarail-map.alanko.dev",
    })
  }, [])

  const isMobile = useIsMobile()
  const activeTrainId = useActiveTrainId()

  return (
    <TooltipProvider>
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
      </SidebarProvider>
    </TooltipProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
