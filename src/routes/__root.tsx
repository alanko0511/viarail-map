import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useRouter,
} from "@tanstack/react-router"
import { configure } from "onedollarstats"
import { useEffect } from "react"

import { TooltipProvider } from "@/components/ui/tooltip"

import appCss from "../styles.css?url"

export const Route = createRootRoute({
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

const REFRESH_INTERVAL_MS = 15_000

function RootLayout() {
  const router = useRouter()

  useEffect(() => {
    configure({
      trackLocalhostAs: "viarail-map.alanko.dev",
    })
  }, [])

  // Upstream refreshes every 15s, so polling faster only wastes requests.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.invalidate()
      }
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [router])

  return (
    <TooltipProvider>
      <Outlet />
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
