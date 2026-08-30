import { useNavigate } from "@tanstack/react-router"

import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useActiveTrainId } from "@/hooks/use-active-train-id"
import { useIsMobile } from "@/hooks/use-mobile"
import { useTrainViews } from "@/hooks/use-train-views"

export function TrainSearchCombobox() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const activeTrainId = useActiveTrainId()
  const trains = useTrainViews()

  // A position is the only reliable sign a train is actually running: the
  // tracker's own "departed" flag just means it has seen a GPS fix.
  const activeIds: Array<string> = []
  const notInServiceIds: Array<string> = []
  for (const [id, train] of trains) {
    if (train.position) {
      activeIds.push(id)
    } else {
      notInServiceIds.push(id)
    }
  }

  const handleChange = (value: string) => {
    if (value) {
      navigate({ to: "/train/$trainId", params: { trainId: value } })
    }
  }

  if (isMobile) {
    return (
      <NativeSelect
        className="w-full"
        value={activeTrainId ?? ""}
        onChange={(e) => handleChange(e.target.value)}
      >
        <NativeSelectOption value="" disabled>
          Select a train...
        </NativeSelectOption>
        {activeIds.map((id) => (
          <NativeSelectOption key={id} value={id}>
            {id}
          </NativeSelectOption>
        ))}
        {notInServiceIds.length > 0 && (
          <NativeSelectOptGroup label="Not in service">
            {notInServiceIds.map((id) => (
              <NativeSelectOption key={id} value={id}>
                {id}
              </NativeSelectOption>
            ))}
          </NativeSelectOptGroup>
        )}
      </NativeSelect>
    )
  }

  return (
    <Select
      value={activeTrainId ?? null}
      onValueChange={(value: string | null) => value && handleChange(value)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a train..." />
      </SelectTrigger>
      <SelectContent>
        {activeIds.map((id) => (
          <SelectItem key={id} value={id}>
            {id}
          </SelectItem>
        ))}
        {notInServiceIds.length > 0 && (
          <>
            {activeIds.length > 0 && <SelectSeparator />}
            <SelectGroup>
              <SelectLabel>Not in service</SelectLabel>
              {notInServiceIds.map((id) => (
                <SelectItem key={id} value={id}>
                  {id}
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        )}
      </SelectContent>
    </Select>
  )
}
