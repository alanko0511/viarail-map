import * as React from "react"
import { useMatch } from "@tanstack/react-router"
import { TerminalIcon } from "lucide-react"

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
            <SidebarMenuButton size="lg" render={<a href="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <TerminalIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Acme Inc</span>
                <span className="truncate text-xs">Enterprise</span>
              </div>
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
        <div className="px-2 py-2 text-xs text-muted-foreground">
          Data from VIA Rail Canada. Not affiliated with VIA Rail.
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
