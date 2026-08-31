import { stopById, stopTimes } from "@/data/gtfs"
import type { TrainView } from "@/lib/view-model"
import type {
  Carriage,
  ConsistQuery,
  ConsistResponse,
} from "@/server/schemas/consist"

export interface ConsistClass {
  label: string
  cars: number
  /** 0 for service cars, which carry no revenue seats. */
  seats: number
}

export interface ConsistSummary {
  carCount: number
  /** Fleet types present, e.g. ["Siemens Venture"] or ["LRC", "HEP2"]. */
  equipment: Array<string>
  classes: Array<ConsistClass>
}

/**
 * Reading order for the rollups: what you can sit in first, then what the train
 * carries to support it. Anything unlisted sorts to the end.
 */
const CLASS_ORDER = [
  "Business",
  "Economy",
  "Sleeper",
  "Prestige",
  "Dome",
  "Dining",
  "Baggage",
  "Crew",
  "Service",
  "Transition",
]

/**
 * The `VIDE` shells stand in for cars the booking system cannot sell into, so
 * their `carriage_type` is one shared catch-all string and the car number
 * carries the real identity instead.
 */
const SHELL_LABELS: Record<string, string> = {
  BAG: "Baggage",
  SKY: "Dome",
  DINER: "Dining",
  CREW: "Crew",
  SVC: "Service",
  TRANS: "Transition",
}

/** VIA's yard nomenclature is not customer-facing; only Venture has a name. */
function equipmentName(carriage: Carriage): string | null {
  const code = carriage.code.toUpperCase()
  if (code === "VEN") return "Siemens Venture"
  if (code === "LRC") return "LRC"
  if (code === "HEP") {
    // "HEP1 - H54N - ..." and "HEP2 - HBJ91 - ..." name their generation, but
    // the sleepers just say "HEP - 2HMNT - MANOR Sleeper". Those Manor, Chateau
    // and Park cars are HEP1 stock, so the bare form resolves there rather than
    // splitting one train across "HEP1" and "HEP".
    const match = /^HEP[12]/.exec(carriage.type)
    return match ? match[0] : "HEP1"
  }
  // VID is a placeholder, not a fleet type, so it names no equipment.
  if (code === "VID") return null
  return code
}

function classLabel(carriage: Carriage): string {
  if (carriage.code.toUpperCase() === "VID") {
    return SHELL_LABELS[carriage.number.toUpperCase()] ?? "Other"
  }

  const type = carriage.type.toLowerCase()
  // Prestige is checked first: those cars are sleepers too, and the fare
  // class is what a passenger recognises.
  if (type.includes("prestige")) return "Prestige"
  if (type.includes("sleeper")) return "Sleeper"
  // The class word is not always followed by "car": the corridor business cars
  // read "40 + 2 Bus  50-50 - WC - 2crew".
  if (/\bbus\b/.test(type)) return "Business"
  if (/\beco\b/.test(type)) return "Economy"
  return "Other"
}

export function summarizeConsist(response: ConsistResponse): ConsistSummary {
  const carriages = response.carriages

  const equipment: Array<string> = []
  const byClass = new Map<string, ConsistClass>()

  for (const carriage of carriages) {
    const name = equipmentName(carriage)
    if (name && !equipment.includes(name)) equipment.push(name)

    const label = classLabel(carriage)
    const entry = byClass.get(label) ?? { label, cars: 0, seats: 0 }
    entry.cars += 1
    entry.seats += carriage.seatCount
    byClass.set(label, entry)
  }

  const rank = (label: string) => {
    const index = CLASS_ORDER.indexOf(label)
    return index === -1 ? CLASS_ORDER.length : index
  }

  return {
    carCount: carriages.length,
    equipment,
    classes: [...byClass.values()].sort(
      (a, b) => rank(a.label) - rank(b.label)
    ),
  }
}

/** `"20260831"` -> `"2026-08-31"`, the form traincar.info expects. */
function toIsoDate(startDate: string): string {
  return `${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)}`
}

/**
 * The four parameters traincar.info needs, or null when this train cannot be
 * looked up.
 *
 * The endpoints come from the GTFS trip rather than `train.stops`: the tracker
 * publishes only part of some trains' stop lists (see `stopsAreTruncated`), and
 * a mid-route origin makes the reservation system answer "Requested station not
 * found on requested service".
 */
export function consistQuery(train: TrainView): ConsistQuery | null {
  if (!train.tripId) return null

  const times = stopTimes[train.tripId]
  if (!times || times.length < 2) return null

  const origin = stopById.get(times[0][1])
  const destination = stopById.get(times[times.length - 1][1])
  if (!origin || !destination) return null

  return {
    number: train.number,
    date: toIsoDate(train.startDate),
    origin: origin.code,
    destination: destination.code,
  }
}
