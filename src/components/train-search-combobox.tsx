import { useNavigate } from "@tanstack/react-router"
import { SearchIcon } from "lucide-react"

import { Route as RootRoute } from "@/routes/__root"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

export function TrainSearchCombobox() {
  const navigate = useNavigate()
  const trainData = RootRoute.useLoaderData()
  const trainIds = Object.keys(trainData)

  return (
    <Combobox
      onValueChange={(value) => {
        if (value) {
          navigate({ to: "/train/$trainId", params: { trainId: String(value) } })
        }
      }}
    >
      <ComboboxInput
        placeholder="Search trains..."
        showTrigger={false}
      />
      <ComboboxContent>
        <ComboboxList>
          <ComboboxEmpty>No trains found.</ComboboxEmpty>
          {trainIds.map((id) => (
            <ComboboxItem key={id} value={id}>
              <SearchIcon className="text-muted-foreground" />
              {id}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
