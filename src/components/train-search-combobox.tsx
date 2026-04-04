import { useNavigate } from "@tanstack/react-router"
import { SearchIcon } from "lucide-react"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

// Placeholder data — will be replaced with server data
const MOCK_TRAINS = [
  { id: "1", label: "Train 1 — Ottawa to Toronto" },
  { id: "2", label: "Train 2 — Toronto to Montreal" },
  { id: "3", label: "Train 3 — Montreal to Quebec City" },
]

export function TrainSearchCombobox() {
  const navigate = useNavigate()

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
          {MOCK_TRAINS.map((train) => (
            <ComboboxItem key={train.id} value={train.id}>
              <SearchIcon className="text-muted-foreground" />
              {train.label}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
