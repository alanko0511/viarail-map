export const getLogger = (name: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (level: "debug" | "info" | "warn" | "error", ...args: any[]) => {
    console[level](`[${name}]`, ...args);
  };
};

// Station status utilities
export type StationTimeInfo = {
  estimated?: string;
  departure?: { estimated?: string | null };
  arrival?: { estimated?: string | null };
};

export const hasDepartedFromStation = (stationTime: StationTimeInfo, now: Date = new Date()) => {
  return stationTime.departure?.estimated ? new Date(stationTime.departure.estimated) <= now : false;
};

export const hasArrivedAtStation = (stationTime: StationTimeInfo, now: Date = new Date()) => {
  // Final stations have an 'arrival' object
  if ("arrival" in stationTime && stationTime.arrival?.estimated) {
    return new Date(stationTime.arrival.estimated) <= now;
  }

  // Intermediate stations use the top-level 'estimated' field for arrival time
  if (stationTime.estimated) {
    return new Date(stationTime.estimated) <= now;
  }

  return false;
};

export const isStationCompleted = (
  stationTime: StationTimeInfo,
  index: number,
  totalStations: number,
  now: Date = new Date()
) => {
  const isLastStation = index === totalStations - 1;

  if (isLastStation) {
    return hasArrivedAtStation(stationTime, now);
  }

  return hasArrivedAtStation(stationTime, now);
};
