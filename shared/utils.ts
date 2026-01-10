import type { NormalizedStationTime } from "./types";

export const getLogger = (name: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (level: "debug" | "info" | "warn" | "error", ...args: any[]) => {
    console[level](`[${name}]`, ...args);
  };
};

// Station status utilities using normalized types

export const hasDepartedFromStation = (
  stationTime: NormalizedStationTime,
  now: Date = new Date()
) => {
  return stationTime.departure?.estimated
    ? new Date(stationTime.departure.estimated) <= now
    : false;
};

export const hasArrivedAtStation = (
  stationTime: NormalizedStationTime,
  now: Date = new Date()
) => {
  return stationTime.arrival?.estimated
    ? new Date(stationTime.arrival.estimated) <= now
    : false;
};

export const isStationCompleted = (
  stationTime: NormalizedStationTime,
  now: Date = new Date()
) => {
  return hasArrivedAtStation(stationTime, now);
};
