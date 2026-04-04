import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar"

export function TrainTimeline({ trainId }: { trainId: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Train {trainId}</SidebarGroupLabel>
      <div className="px-4 py-2 text-sm text-muted-foreground">
        Timeline and stops will appear here.
      </div>
    </SidebarGroup>
  )
}
