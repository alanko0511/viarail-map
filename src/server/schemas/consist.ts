import * as z from "zod"

/**
 * One car in a train's consist.
 *
 * traincar.info is a community proxy over VIA's reservation backend, so the
 * payload is really a booking system's seat map — every seat carries its own
 * coordinates, fare class and availability. Only the count survives the parse:
 * the Canadian's twenty cars would otherwise ship a few hundred kilobytes of
 * seat geometry to the browser for a number the sidebar renders as "288 seats".
 */
export const CarriageSchema = z
  .object({
    sequence_number: z.number(),
    /** Usually a printed car number ("1"), but "BAG"/"SKY"/"DINER" on shells. */
    carriage_number: z.string(),
    /** VEN | LRC | HEP | VID. */
    carriage_code: z.string(),
    carriage_name: z.string(),
    /** VIA's internal description, e.g. "VEN - GL - 3A (ssr) - 41  Bus car - 1WC". */
    carriage_type: z.string(),
    /** Empty on the VIDE placeholder shells (baggage, dome, diner, crew). */
    seats: z.array(z.unknown()).default([]),
  })
  .transform((carriage) => ({
    sequence: carriage.sequence_number,
    number: carriage.carriage_number,
    code: carriage.carriage_code,
    name: carriage.carriage_name,
    type: carriage.carriage_type,
    seatCount: carriage.seats.length,
  }))

export const ConsistResponseSchema = z
  .object({
    carriageLayout: z.object({
      carriages: z.array(CarriageSchema),
    }),
  })
  .transform((response) => ({
    carriages: response.carriageLayout.carriages,
  }))

export type Carriage = z.infer<typeof CarriageSchema>
export type ConsistResponse = z.infer<typeof ConsistResponseSchema>

/** The four parameters traincar.info's endpoint takes. */
export const ConsistQuerySchema = z.object({
  number: z.string(),
  /** YYYY-MM-DD. */
  date: z.string(),
  /** 4-letter VIA station codes, the same ones GTFS stops.txt carries. */
  origin: z.string(),
  destination: z.string(),
})

export type ConsistQuery = z.infer<typeof ConsistQuerySchema>
