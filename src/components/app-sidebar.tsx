import { Link, useMatch } from "@tanstack/react-router"
import * as React from "react"

import { TrainSearchCombobox } from "@/components/train-search-combobox"
import { TrainTimeline } from "@/components/train-timeline"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const trainMatch = useMatch({
    from: "/train/$trainId",
    shouldThrow: false,
  })

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to="/" />}
              variant="default"
            >
              <span className="truncate font-medium">VIA Rail Map</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <TrainSearchCombobox />
      </SidebarHeader>

      <SidebarContent>
        {trainMatch ? (
          <TrainTimeline trainId={trainMatch.params.trainId} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-muted-foreground">
            Search or click on a train to see details
          </div>
        )}
      </SidebarContent>

      <SidebarFooter>
        <div className="space-y-2 px-2 py-2 text-xs text-muted-foreground">
          <p>
            GitHub:{" "}
            <a
              href="https://github.com/alanko0511/viarail-map"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              alanko0511/viarail-map
            </a>
          </p>
          <div>
            <p>Data source:</p>
            <ul className="ml-4 list-disc">
              <li>VIA Rail Canada (live train data)</li>
              <li>RailFansMap (route data)</li>
            </ul>
          </div>
          <p>
            The project is not affiliated with VIA Rail Canada. Check out{" "}
            <a
              href="https://www.viarail.ca"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              viarail.ca
            </a>{" "}
            for the latest news and information about your journey.
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
