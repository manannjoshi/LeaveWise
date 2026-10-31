// The API and UI share these small types so their data stays consistent.
export type TravelMode = "car" | "two-wheeler" | "walk";
export type Importance = "casual" | "important" | "critical";
export type WeatherStatus = "rain" | "clear" | "unavailable";

export type Place = {
  label: string;
  lat: number;
  lon: number;
};

export type TripRequest = {
  origin: Place;
  destination: Place;
  arriveBy: string;
  mode: TravelMode;
  importance: Importance;
  fixedBufferMinutes?: number;
};

export type LeavePlan = {
  leaveAt: string;
  arriveBy: string;
  durationMinutes: number;
  safetyMarginMinutes: number;
  fixedBufferMinutes: number;
  weatherPenaltyMinutes: number;
  weatherStatus: WeatherStatus;
  safetyMarginMethod: "percentage" | "learned";
  safetyMarginSampleCount: number;
  confidence: number;
  explanation: string;
  source: "tomtom" | "mock";
};
