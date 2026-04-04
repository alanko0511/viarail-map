import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"

import type {
  ProcessedStop,
  StationStatus,
} from "@/server/schemas/processed-train"
import { Route as RootRoute } from "@/routes/__root"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}

function getDelayColor(minutes: number): string {
  if (minutes < 5) return "bg-green-500/70 text-white"
  if (minutes <= 30) return "bg-orange-500/70 text-white"
  return "bg-red-500/70 text-white"
}

function getEstimatedColor(delayMinutes: number | null): string {
  if (delayMinutes === null || delayMinutes <= 0) return "text-muted-foreground"
  if (delayMinutes < 5) return "text-green-500/70"
  if (delayMinutes <= 30) return "text-orange-500/70"
  return "text-red-500/70"
}

function StopIcon({ status }: { status: StationStatus }) {
  if (status === "left") {
    return (
      <div className="flex size-6 items-center justify-center rounded-full bg-blue-500 text-white">
        <CircleCheckIcon className="size-4" />
      </div>
    )
  }

  if (status === "arrived") {
    return (
      <div className="flex size-6 items-center justify-center rounded-full bg-blue-500 ring-4 ring-blue-500/30">
        <div className="size-2.5 rounded-full bg-white" />
      </div>
    )
  }

  // coming
  return (
    <div className="flex size-6 items-center justify-center rounded-full border-2 border-muted-foreground">
      <div className="size-2 rounded-full border border-muted-foreground" />
    </div>
  )
}

function TimeRow({
  label,
  scheduled,
  estimated,
  delayMinutes,
}: {
  label: string
  scheduled: string | null
  estimated: string | null
  delayMinutes: number | null
}) {
  if (!scheduled) return null

  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="w-20 text-muted-foreground">{label}:</span>
      <span className="font-medium">{formatTime(scheduled)}</span>
      {estimated && (
        <span className={cn(getEstimatedColor(delayMinutes))}>
          (Est: {formatTime(estimated)})
        </span>
      )}
    </div>
  )
}

function TimelineStop({
  stop,
  isLast,
  nextStatus,
}: {
  stop: ProcessedStop
  isLast: boolean
  nextStatus: StationStatus | undefined
}) {
  const showDelay =
    stop.delayMinutes !== null && stop.delayMinutes > 0

  // Line color: blue solid if current stop is left or arrived, gray dashed otherwise
  const lineIsSolid =
    stop.status === "left" ||
    (stop.status === "arrived" && nextStatus !== undefined)
  const lineIsBlue = stop.status === "left"

  return (
    <div className="flex gap-3">
      {/* Icon column with connecting line */}
      <div className="flex flex-col items-center">
        <StopIcon status={stop.status} />
        {!isLast && (
          <div
            className={cn(
              "w-0.5 flex-1 min-h-4",
              lineIsBlue || lineIsSolid
                ? "bg-blue-500"
                : "bg-muted-foreground",
            )}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{stop.station}</span>
          {showDelay && (
            <Badge
              className={cn(
                "h-5 rounded-full px-1.5 text-[10px] font-semibold",
                getDelayColor(stop.delayMinutes!),
              )}
            >
              +{stop.delayMinutes}M
            </Badge>
          )}
        </div>

        <div className="mt-1 space-y-0.5">
          {stop.arrival && (
            <TimeRow
              label="Arrival"
              scheduled={stop.arrival.scheduled}
              estimated={stop.arrival.estimated}
              delayMinutes={stop.delayMinutes}
            />
          )}
          {stop.departure && (
            <TimeRow
              label="Departure"
              scheduled={stop.departure.scheduled}
              estimated={stop.departure.estimated}
              delayMinutes={stop.delayMinutes}
            />
          )}
        </div>

        <div className="mt-1 text-xs text-muted-foreground">{stop.code}</div>
      </div>
    </div>
  )
}

export function TrainTimeline({ trainId }: { trainId: string }) {
  const trainData = RootRoute.useLoaderData()
  const train = trainData[trainId]

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- trainId may not exist in data
  if (!train) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>Train {trainId}</SidebarGroupLabel>
        <div className="px-4 py-2 text-sm text-muted-foreground">
          Train not found.
        </div>
      </SidebarGroup>
    )
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        Train {trainId} — {train.from} → {train.to}
      </SidebarGroupLabel>
      {train.alerts.length > 0 && (
        <div className="space-y-2 px-2 pt-2">
          {train.alerts.map((alert, i) => (
            <Alert key={i} variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>{alert.header.en}</AlertTitle>
              <AlertDescription>
                {alert.description.en}
                {alert.url.en && (
                  <a
                    href={alert.url.en}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 underline"
                  >
                    Learn more
                  </a>
                )}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}
      <div className="px-2 py-2">
        {train.stops.map((stop, i) => (
          <TimelineStop
            key={stop.code + i}
            stop={stop}
            isLast={i === train.stops.length - 1}
            nextStatus={train.stops[i + 1]?.status}
          />
        ))}
      </div>
    </SidebarGroup>
  )
}
