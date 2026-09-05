import { Link } from "@tanstack/react-router"
import { ChevronDownIcon } from "lucide-react"
import * as React from "react"

import { TrainSearchCombobox } from "@/components/train-search-combobox"
import { TrainTimeline } from "@/components/train-timeline"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useActiveTrainId } from "@/hooks/use-active-train-id"
import { useLastTrainId } from "@/hooks/use-last-train-id"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const activeTrainId = useActiveTrainId()
  const lastTrainId = useLastTrainId(activeTrainId)

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
        {activeTrainId ? (
          <TrainTimeline trainId={activeTrainId} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
            <p>Search or click on a train to see details</p>
            {lastTrainId && (
              <p>
                Last time you were looking at{" "}
                <Link
                  to="/train/$trainId"
                  params={{ trainId: lastTrainId }}
                  className="underline hover:text-foreground"
                >
                  train {lastTrainId}
                </Link>
              </p>
            )}
          </div>
        )}
      </SidebarContent>

      <SidebarFooter>
        <div className="space-y-2 px-2 py-2 text-xs text-muted-foreground">
          <Collapsible className="space-y-2">
            <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 rounded-md py-1 text-left hover:text-foreground">
              <span>About this map</span>
              <ChevronDownIcon className="size-3.5 shrink-0 transition-transform group-data-[panel-open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2">
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
                  <li>VIA Rail Canada (GTFS schedule)</li>
                  <li>
                    <a
                      href="https://traincar.info"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-foreground"
                    >
                      traincar.info
                    </a>{" "}
                    (train consist)
                  </li>
                </ul>
              </div>
              <p>
                Rebuilt as{" "}
                <a href="/gtfs" className="underline hover:text-foreground">
                  GTFS feeds
                </a>{" "}
                you can use elsewhere.
              </p>
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
            </CollapsibleContent>
          </Collapsible>
          {/* The Open Government Licence requires this statement wherever the
              data is served, so it stays outside the collapsible. */}
          <p>
            Contains information licensed under the{" "}
            <a
              href="https://open.canada.ca/en/open-government-licence-canada"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Open Government Licence – Canada
            </a>
            .
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
