import { useSidebar } from "@/components/ui/sidebar"
import { useTrainViews } from "@/hooks/use-train-views"
import { formatStopTime } from "@/lib/format-time"

export function MobileTrainBar({ trainId }: { trainId: string | undefined }) {
  const trains = useTrainViews()
  const train = trainId ? trains.get(trainId) : undefined
  const { toggleSidebar } = useSidebar()

  const nextStop = train?.stops.find((stop) => stop.status === "coming")
  const nextStopTime =
    nextStop?.arrival?.predicted ?? nextStop?.arrival?.scheduled

  return (
    // The wrapper only centres the pill. It must not catch taps, or its
    // invisible margins cover the map controls in the top-right corner.
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center px-4 pt-2.5">
      <button
        type="button"
        onClick={toggleSidebar}
        className="pointer-events-auto rounded-lg bg-black/70 px-4 py-2 text-center backdrop-blur-sm"
      >
        {train && trainId ? (
          <>
            <div className="text-xs font-medium text-white">
              Train {train.number} → {train.headsign}
            </div>
            {nextStop && (
              <div className="text-xs text-white/70">
                Next: {nextStop.name}
                {nextStopTime &&
                  ` · ${formatStopTime(nextStopTime, nextStop.timezone)}`}
              </div>
            )}
          </>
        ) : (
          <div className="text-xs font-medium text-white/70">
            Tap to select a train
          </div>
        )}
      </button>
    </div>
  )
}
