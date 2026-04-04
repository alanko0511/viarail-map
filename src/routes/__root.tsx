import {
  HeadContent,
  Scripts,
  createRootRoute,
  useMatch,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"

import { getTrainData } from "@/server/trains"
import appCss from "../styles.css?url"
import { AppSidebar } from "@/components/app-sidebar"
import { TrainMap } from "@/components/map"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MobileTrainBar } from "@/components/mobile-train-bar"
import { useIsMobile } from "@/hooks/use-mobile"

export const Route = createRootRoute({
  loader: () => getTrainData({ data: { timeZone: "America/Toronto" } }),
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
  const isMobile = useIsMobile()
  const trainMatch = useMatch({
    from: "/train/$trainId",
    shouldThrow: false,
  })

  const activeTrainId = trainMatch?.params.trainId

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="overflow-hidden">
          <div className="relative flex h-full flex-1 flex-col">
            <SidebarTrigger className="absolute left-2 top-2 z-10 max-md:hidden" />
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
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
