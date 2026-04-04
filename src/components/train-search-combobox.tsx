import { useNavigate } from "@tanstack/react-router"

import { Route as RootRoute } from "@/routes/__root"
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

export function TrainSearchCombobox() {
  const navigate = useNavigate()
  const trainData = RootRoute.useLoaderData()

  const activeIds: string[] = []
  const notInServiceIds: string[] = []
  for (const [id, train] of Object.entries(trainData)) {
    if (train.departed && !train.arrived) {
      activeIds.push(id)
    } else {
      notInServiceIds.push(id)
    }
  }

  return (
    <Select
      onValueChange={(value: string | null) => {
        if (value) {
          navigate({ to: "/train/$trainId", params: { trainId: value } })
        }
      }}
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
