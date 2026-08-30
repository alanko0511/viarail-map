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

// A stop served by a substitute service. Handled by the upstream site's JS but
// absent from every snapshot we have captured, so it is modelled leniently.
export const ReplacedSchema = z.object({
  mode: z.string(),
  services: z.array(z.string()),
})

// One station stop in the times array.
// Everything beyond station/code/scheduled is optional: upstream changed the
// time semantics between April and August 2026 without notice, so the realistic
// failure mode is a field disappearing.
export const StationTimeSchema = z.object({
  station: z.string(),
  code: z.string(),
  tz: z.string().optional(),
  estimated: z.string().nullable().optional(),
  scheduled: z.string(),
  eta: z.string().nullable().optional(),
  departure: ScheduledTimeSchema.optional(),
  arrival: ScheduledTimeSchema.optional(),
  diff: z.string().optional(),
  diffMin: z.number().optional(),
  cancelled: z.boolean().optional(),
  replaced: ReplacedSchema.optional(),
})

// Single train object
export const TrainSchema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
  speed: z.number().optional(),
  direction: z.number().nullable().optional(),
  poll: z.string().optional(),
  pollMin: z.number().optional(),
  pollRadius: z.number().optional(),
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
export type Replaced = z.infer<typeof ReplacedSchema>
export type StationTime = z.infer<typeof StationTimeSchema>
export type Train = z.infer<typeof TrainSchema>
export type AllTrainData = z.infer<typeof AllTrainDataSchema>
