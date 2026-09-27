import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { useNavigate } from "@tanstack/react-router"
import { useRef } from "react"

import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
} from "@/components/ui/combobox"
import { useActiveTrainId } from "@/hooks/use-active-train-id"
import { useTrainViews } from "@/hooks/use-train-views"

interface TrainOption {
  value: string
  /** The tracker key, e.g. "1 (08-30)", shown in the input once picked. */
  label: string
  number: string
  /** "Toronto → Ottawa", or empty for a train the schedule doesn't know. */
  journey: string
  /** Set only when the key carries one, to tell apart runs of a multi-day train. */
  startDay: string | null
}

interface TrainGroup {
  value: string
  items: Array<TrainOption>
}

const NOT_IN_SERVICE = "Not in service"

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
})

/** "20260830" → "Aug 30". */
function formatStartDay(startDate: string): string {
  const [year, month, day] = [
    startDate.slice(0, 4),
    startDate.slice(4, 6),
    startDate.slice(6, 8),
  ].map(Number)
  return dayFormat.format(new Date(Date.UTC(year, month - 1, day)))
}

export function TrainSearchCombobox() {
  const navigate = useNavigate()
  const activeTrainId = useActiveTrainId()
  const trains = useTrainViews()
  const { startsWith } = ComboboxPrimitive.useFilter()
  const listRef = useRef<HTMLDivElement>(null)

  // A position is the only reliable sign a train is actually running: the
  // tracker's own "departed" flag just means it has seen a GPS fix.
  const active: Array<TrainOption> = []
  const notInService: Array<TrainOption> = []
  let selected: TrainOption | null = null
  for (const [id, train] of trains) {
    const journey = train.headsign ? `${train.origin} → ${train.headsign}` : ""
    const option: TrainOption = {
      value: id,
      label: id,
      number: train.number,
      journey,
      startDay:
        id !== train.number && train.startDate
          ? formatStartDay(train.startDate)
          : null,
    }
    if (id === activeTrainId) selected = option
    ;(train.position ? active : notInService).push(option)
  }

  const groups: Array<TrainGroup> = [
    { value: "In service", items: active },
    { value: NOT_IN_SERVICE, items: notInService },
  ].filter((group) => group.items.length > 0)

  // Only the train number is searchable: "64" finds 64 and 646, not 164.
  const filter = (option: TrainOption, query: string) =>
    startsWith(option, query, (item: TrainOption) => item.number)

  return (
    <Combobox
      items={groups}
      value={selected}
      onValueChange={(option: TrainOption | null) => {
        if (option) {
          navigate({ to: "/train/$trainId", params: { trainId: option.value } })
        }
      }}
      isItemEqualToValue={(a: TrainOption, b: TrainOption) =>
        a.value === b.value
      }
      filter={filter}
      autoHighlight
      // Opening scrolls the list to the selected train, and filtering keeps
      // that offset, which hides the highlighted first match above the fold.
      onInputValueChange={() => {
        if (listRef.current) listRef.current.scrollTop = 0
      }}
    >
      <ComboboxInput
        className="w-full"
        placeholder="Search train number..."
        aria-label="Search train number"
        inputMode="numeric"
      />
      <ComboboxContent>
        <ComboboxEmpty>No trains found.</ComboboxEmpty>
        <ComboboxList ref={listRef}>
          {(group: TrainGroup, index: number) => (
            <ComboboxGroup key={group.value} items={group.items}>
              {index > 0 && <ComboboxSeparator />}
              {group.value === NOT_IN_SERVICE && (
                <ComboboxLabel>{group.value}</ComboboxLabel>
              )}
              <ComboboxCollection>
                {(option: TrainOption) => (
                  <ComboboxItem key={option.value} value={option}>
                    <span className="min-w-[3ch] shrink-0 tabular-nums">
                      {option.number}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {option.journey}
                    </span>
                    {option.startDay && (
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {option.startDay}
                      </span>
                    )}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
