import type { Alert } from "./train"

export type StationStatus = "coming" | "arrived" | "left"

export interface TimePair {
  scheduled: string | null
  estimated: string | null
}

export interface ProcessedStop {
  station: string
  code: string
  status: StationStatus
  arrival: TimePair | null
  departure: TimePair | null
  delayMinutes: number | null
}

export interface ProcessedTrain {
  lat: number | null
  lng: number | null
  speed: number | null
  direction: number | null
  from: string
  to: string
  instance: string
  departed: boolean
  arrived: boolean
  lastUpdated: string | null
  alerts: Array<Alert>
  stops: Array<ProcessedStop>
}

export type ProcessedTrainData = Record<string, ProcessedTrain>
