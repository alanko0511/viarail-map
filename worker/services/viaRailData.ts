import ky from "ky";
import { z } from "zod";

const alertSchema = z.object({
  header: z.object({ en: z.string(), fr: z.string() }),
  description: z.object({ en: z.string(), fr: z.string() }),
  url: z.object({ en: z.string(), fr: z.string() }),
});

const timeSchema = z.object({
  scheduled: z.string(),
  estimated: z.string().nullable().optional(),
});

const stationTimeBaseSchema = z.object({
  station: z.string(),
  code: z.string(),
  estimated: z.string(),
  scheduled: z.string(),
  eta: z.string(),
});

const stationTimeDepartureOnlySchema = stationTimeBaseSchema.extend({
  departure: timeSchema,
  diff: z.string().optional(),
  diffMin: z.number().optional(),
});

const stationTimeWithArrivalSchema = stationTimeBaseSchema.extend({
  arrival: timeSchema,
  departure: timeSchema.optional(),
  diff: z.string().optional(),
  diffMin: z.number().optional(),
});

const stationTimeSchema = z.union([stationTimeDepartureOnlySchema, stationTimeWithArrivalSchema]);

const baseTrainSchema = z.object({
  departed: z.boolean(),
  arrived: z.boolean(),
  from: z.string(),
  to: z.string(),
  instance: z.string(),
  times: z.array(stationTimeSchema),
});

const trainSchema = z.intersection(
  baseTrainSchema,
  z.object({
    lat: z.number().optional(),
    lng: z.number().optional(),
    speed: z.number().optional(),
    direction: z.union([z.number(), z.null()]).optional(),
    poll: z.string().optional(),
    pollMin: z.number().optional(),
    alerts: z.array(alertSchema).optional(),
  })
);

const schema = z.record(z.union([z.string(), z.number()]), trainSchema);

export type StationTime = z.infer<typeof stationTimeSchema>;
export type Train = z.infer<typeof trainSchema>;
export type ViaRailData = z.infer<typeof schema>;

export const getViaRailData = async () => {
  const response = await ky
    .get("https://tsimobile.viarail.ca/data/allData.json", {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
      },
    })
    .json();
  return schema.parse(response);
};
