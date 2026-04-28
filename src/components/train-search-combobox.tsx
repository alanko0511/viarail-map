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
import { useIsMobile } from "@/hooks/use-mobile"
import { Route as RootRoute } from "@/routes/__root"

export function TrainSearchCombobox() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { trainData } = RootRoute.useLoaderData()

  const activeIds: Array<string> = []
  const notInServiceIds: Array<string> = []
  for (const [id, train] of Object.entries(trainData)) {
    if (train.departed && !train.arrived) {
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
        defaultValue=""
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
