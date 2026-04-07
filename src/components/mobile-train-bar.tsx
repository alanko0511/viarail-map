import { Route as RootRoute } from "@/routes/__root"
import { useSidebar } from "@/components/ui/sidebar"

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}

export function MobileTrainBar({ trainId }: { trainId: string | undefined }) {
  const { trainData } = RootRoute.useLoaderData()
  const train = trainId ? trainData[trainId] : undefined
  const { toggleSidebar } = useSidebar()

  const nextStop = train?.stops.find(
    (s) => s.status === "coming",
  )

  const nextStopTime =
    nextStop?.arrival?.estimated ?? nextStop?.arrival?.scheduled

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className="absolute inset-x-0 top-0 z-10 flex flex-col items-center px-4 pt-2.5"
    >
      <div className="rounded-lg bg-black/70 px-4 py-2 text-center backdrop-blur-sm">
        {train && trainId ? (
          <>
            <div className="text-xs font-medium text-white">
              Train {trainId} — {train.from} → {train.to}
            </div>
            {nextStop && (
              <div className="text-xs text-white/70">
                Next: {nextStop.station}
                {nextStopTime && ` · ${formatTime(nextStopTime)}`}
              </div>
            )}
          </>
        ) : (
          <div className="text-xs font-medium text-white/70">
            Tap to select a train
          </div>
        )}
      </div>
    </button>
  )
}
