import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"

import { TrainConsist } from "@/components/train-consist"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar"
import { useTrainViews } from "@/hooks/use-train-views"
import { formatStopTime } from "@/lib/format-time"
import { cn } from "@/lib/utils"
import type { StopStatus, StopTimeView, StopView } from "@/lib/view-model"

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

function StopIcon({ status }: { status: StopStatus }) {
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
  time,
  timeZone,
  delayMinutes,
}: {
  label: string
  time: StopTimeView | null
  timeZone: string
  delayMinutes: number | null
}) {
  if (!time) return null

  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="w-20 text-muted-foreground">{label}:</span>
      <span className="font-medium">
        {formatStopTime(time.scheduled, timeZone)}
      </span>
      {time.predicted && (
        <span className={cn(getEstimatedColor(delayMinutes))}>
          (Est: {formatStopTime(time.predicted, timeZone)})
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
  stop: StopView
  isLast: boolean
  nextStatus: StopStatus | undefined
}) {
  const showDelay = stop.delayMinutes !== null && stop.delayMinutes > 0

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
              "min-h-4 w-0.5 flex-1",
              lineIsBlue || lineIsSolid ? "bg-blue-500" : "bg-muted-foreground"
            )}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{stop.name}</span>
          {stop.cancelled && (
            <Badge className="h-5 rounded-full bg-red-500/70 px-1.5 text-[10px] font-semibold text-white">
              CANCELLED
            </Badge>
          )}
          {showDelay && (
            <Badge
              className={cn(
                "h-5 rounded-full px-1.5 text-[10px] font-semibold",
                getDelayColor(stop.delayMinutes!)
              )}
            >
              +{stop.delayMinutes}M
            </Badge>
          )}
        </div>

        <div className="mt-1 space-y-0.5">
          <TimeRow
            label="Arrival"
            time={stop.arrival}
            timeZone={stop.timezone}
            delayMinutes={stop.delayMinutes}
          />
          {/* The origin has no arrival row, so its departure is the only time
              there is to show; elsewhere a departure is only worth a line when
              the train actually dwells. */}
          {(stop.showDwell || !stop.arrival) && (
            <TimeRow
              label="Departure"
              time={stop.departure}
              timeZone={stop.timezone}
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
  const trains = useTrainViews()
  const train = trains.get(trainId)

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
      {/* The label truncates and the badge keeps its intrinsic width, so a long
          headsign (Prince Rupert, Vancouver) cannot push the badge out of the
          sidebar and make it unreachable. */}
      <div className="flex items-center justify-between gap-2 pr-2">
        <SidebarGroupLabel className="min-w-0 flex-1 truncate">
          Train {train.number} → {train.headsign}
        </SidebarGroupLabel>
        <div className="shrink-0">
          <TrainConsist train={train} />
        </div>
      </div>
      {train.routeLongName && (
        <div className="px-2 text-xs text-muted-foreground">
          {train.routeLongName}
        </div>
      )}
      {train.alerts.length > 0 && (
        <div className="space-y-2 px-2 pt-2">
          {train.alerts.map((alert, i) => (
            <Alert key={i} variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>{alert.header}</AlertTitle>
              <AlertDescription>
                {alert.description}
                {alert.url && (
                  <a
                    href={alert.url}
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
        {train.stopsAreTruncated && (
          <p className="px-2 pb-3 text-xs text-muted-foreground">
            VIA publishes only part of this train's stop list.
          </p>
        )}
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
