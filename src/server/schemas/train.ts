import * as z from "zod"

// Reusable bilingual text (used in alerts)
export const LocalizedStringSchema = z.object({
  en: z.string(),
  fr: z.string(),
})

// Alert entry
export const AlertSchema = z.object({
  header: LocalizedStringSchema,
  description: LocalizedStringSchema,
  url: LocalizedStringSchema,
})

// Arrival/departure time pair (optional on first/last stops)
export const ScheduledTimeSchema = z.object({
  estimated: z.string().nullable().optional(),
  scheduled: z.string(),
})

// One station stop in the times array
export const StationTimeSchema = z.object({
  station: z.string(),
  code: z.string(),
  estimated: z.string().nullable(),
  scheduled: z.string(),
  eta: z.string(),
  departure: ScheduledTimeSchema.optional(),
  arrival: ScheduledTimeSchema.optional(),
  diff: z.string().optional(),
  diffMin: z.number().optional(),
})

// Single train object
export const TrainSchema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
  speed: z.number().optional(),
  direction: z.number().nullable().optional(),
  poll: z.string().optional(),
  pollMin: z.number().optional(),
  departed: z.boolean(),
  arrived: z.boolean(),
  from: z.string(),
  to: z.string(),
  instance: z.string(),
  alerts: z.array(AlertSchema).optional(),
  times: z.array(StationTimeSchema),
})

// Top-level: record keyed by train ID strings like "1 (04-01)"
export const AllTrainDataSchema = z.record(z.string(), TrainSchema)

// Inferred types
export type LocalizedString = z.infer<typeof LocalizedStringSchema>
export type Alert = z.infer<typeof AlertSchema>
export type ScheduledTime = z.infer<typeof ScheduledTimeSchema>
export type StationTime = z.infer<typeof StationTimeSchema>
export type Train = z.infer<typeof TrainSchema>
export type AllTrainData = z.infer<typeof AllTrainDataSchema>
