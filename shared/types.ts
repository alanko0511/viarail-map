// Normalized types for VIA Rail data
// These types standardize the inconsistent raw API response

export type NormalizedStationTime = {
  station: string;
  code: string;
  position: "first" | "intermediate" | "last";
  arrival: { scheduled: string | null; estimated: string | null } | null;
  departure: { scheduled: string | null; estimated: string | null } | null;
  delay: { status: "good" | "medium" | "bad" | null; minutes: number | null };
  eta: string | null;
};

export type NormalizedAlert = {
  header: string;
  description: string;
  url: string;
};

export type NormalizedTrain = {
  id: string;
  location: {
    lat: number;
    lng: number;
    speed: number;
    direction: number | null;
  };
  status: {
    departed: boolean;
    arrived: boolean;
  };
  route: {
    from: string;
    to: string;
    instance: string;
  };
  times: NormalizedStationTime[];
  alerts: NormalizedAlert[];
  poll: {
    timestamp: string | null;
    minutesAgo: number | null;
  };
};

export type NormalizedViaRailData = NormalizedTrain[];
