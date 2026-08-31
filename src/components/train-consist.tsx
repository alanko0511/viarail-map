import { TrainFrontIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useTrainConsist } from "@/hooks/use-train-consist"
import type { TrainView } from "@/lib/view-model"

/**
 * Car count and equipment type for the selected train, with the full rollup
 * behind a dialog.
 *
 * Renders nothing when the consist is unknown. traincar.info cannot answer for
 * every train — an unmatched trip, a service the reservation system will not
 * quote — and the header should look exactly as it did before in that case
 * rather than showing an error the reader can do nothing about.
 */
export function TrainConsist({ train }: { train: TrainView }) {
  const { summary, loading } = useTrainConsist(train)

  if (loading) return <Skeleton className="h-6 w-28 rounded-full" />
  if (!summary) return null

  const equipment = summary.equipment.join(" + ")
  const cars = `${summary.carCount} ${summary.carCount === 1 ? "car" : "cars"}`

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-6 rounded-full px-2 text-xs font-normal"
          />
        }
      >
        <TrainFrontIcon className="size-3.5" />
        {equipment ? `${cars} · ${equipment}` : cars}
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Train {train.number} — Consist</DialogTitle>
          <DialogDescription>
            {equipment || "Unknown equipment"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">Cars</span>
            <span className="font-medium">{summary.carCount}</span>
          </div>
          {summary.classes.map((entry) => (
            <div
              key={entry.label}
              className="flex items-baseline justify-between"
            >
              <span className="text-muted-foreground">{entry.label}</span>
              <span className="font-medium">
                {entry.cars}
                {/* Service cars — baggage, domes, diners — sell no seats, and
                    "0 seats" reads like a bug rather than a fact. */}
                {entry.seats > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {entry.seats} seats
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Consist data from{" "}
          <a
            href="https://traincar.info"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            traincar.info
          </a>
          . Last-minute equipment swaps may not be reflected.
        </p>
      </DialogContent>
    </Dialog>
  )
}
