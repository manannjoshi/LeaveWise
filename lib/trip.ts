// The API and UI share these small types so their data stays consistent.
export type TravelMode = "car" | "two-wheeler" | "walk";
export type Importance = "casual" | "important" | "critical";
export type WeatherStatus = "rain" | "clear" | "unavailable";
export type WeatherIconKind = "sun" | "moon" | "partly-cloudy" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm";

export type DepartureWeather = {
  condition: string;
  icon: WeatherIconKind;
  temperatureC: number | null;
  precipitationProbability: number | null;
};

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
  departureWeather?: DepartureWeather | null;
  safetyMarginMethod: "percentage" | "learned";
  safetyMarginSampleCount: number;
  confidence: number;
  explanation: string;
  source: "tomtom" | "mock";
};
