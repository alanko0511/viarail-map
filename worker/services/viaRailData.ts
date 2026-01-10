import ky from "ky";
import { z } from "zod";
import type {
  NormalizedAlert,
  NormalizedStationTime,
  NormalizedTrain,
  NormalizedViaRailData,
} from "../../shared/types";

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

const getRawViaRailData = async () => {
  const response = await ky
    .get("https://tsimobile.viarail.ca/data/allData.json", {
      headers: {
        // The API is behind AWS Cloudfront and blocks requests when no user-agent is provided, so we need to provide a fake one.
        // I'm using the one I saw in the browser's developer tools to make it look like a real browser request.
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
      },
    })
    .json();
  return schema.parse(response);
};

const normalizeDelayStatus = (diff?: string): "good" | "medium" | "bad" | null => {
  if (!diff) return null;
  if (diff === "goo") return "good";
  if (diff === "med") return "medium";
  if (diff === "bad") return "bad";
  return null;
};

const normalizeStationTime = (
  time: StationTime,
  index: number,
  total: number
): NormalizedStationTime => {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const position: NormalizedStationTime["position"] = isFirst
    ? "first"
    : isLast
      ? "last"
      : "intermediate";

  const hasArrival = "arrival" in time;

  return {
    station: time.station,
    code: time.code,
    position,
    arrival: hasArrival
      ? {
          scheduled: time.arrival.scheduled,
          estimated: time.arrival.estimated ?? null,
        }
      : isFirst
        ? null
        : {
            // Intermediate stations use top-level fields for arrival
            scheduled: time.scheduled,
            estimated: time.estimated,
          },
    departure: time.departure
      ? {
          scheduled: time.departure.scheduled,
          estimated: time.departure.estimated ?? null,
        }
      : null,
    delay: {
      status: normalizeDelayStatus(time.diff),
      minutes: time.diffMin ?? null,
    },
    eta: time.eta,
  };
};

const normalizeAlerts = (alerts?: z.infer<typeof alertSchema>[]): NormalizedAlert[] => {
  if (!alerts) return [];
  return alerts.map((alert) => ({
    header: alert.header.en,
    description: alert.description.en,
    url: alert.url.en,
  }));
};

const normalizeTrain = (id: string, train: Train): NormalizedTrain | null => {
  // Filter out trains without location
  if (train.lat === undefined || train.lng === undefined) {
    return null;
  }

  return {
    id,
    location: {
      lat: train.lat,
      lng: train.lng,
      speed: train.speed ?? 0,
      direction: train.direction ?? null,
    },
    status: {
      departed: train.departed,
      arrived: train.arrived,
    },
    route: {
      from: train.from,
      to: train.to,
      instance: train.instance,
    },
    times: train.times.map((time, index) =>
      normalizeStationTime(time, index, train.times.length)
    ),
    alerts: normalizeAlerts(train.alerts),
    poll: {
      timestamp: train.poll ?? null,
      minutesAgo: train.pollMin ?? null,
    },
  };
};

const normalizeViaRailData = (data: ViaRailData): NormalizedViaRailData => {
  const trains: NormalizedTrain[] = [];

  for (const [id, train] of Object.entries(data)) {
    const normalized = normalizeTrain(String(id), train);
    if (normalized) {
      trains.push(normalized);
    }
  }

  return trains;
};

export const getViaRailData = async (): Promise<NormalizedViaRailData> => {
  const rawData = await getRawViaRailData();
  return normalizeViaRailData(rawData);
};
