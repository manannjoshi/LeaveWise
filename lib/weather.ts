import type { TravelMode, WeatherStatus } from "./trip";

export const RAIN_PENALTY_MINUTES = 6;

export type HourlyRainForecast = {
  time: string[];
  rain: Array<number | null>;
};

// Open-Meteo returns GMT timestamps without an offset when timezone=GMT is used.
function toUtcTimestamp(value: string) {
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  if (hasTimezone) return Date.parse(value);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return Date.parse(`${value}:00Z`);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)) return Date.parse(`${value}Z`);
  return Number.NaN;
}

// Rain is a preceding-hour sum, so use the end of the hour containing departure.
export function rainAtDeparture(forecast: HourlyRainForecast | null, leaveAt: string): WeatherStatus {
  if (!forecast) return "unavailable";
  const departure = Date.parse(leaveAt);
  if (!Number.isFinite(departure) || forecast.time.length !== forecast.rain.length) return "unavailable";

  const targetHour = Math.ceil(departure / 3_600_000) * 3_600_000;
  const index = forecast.time.findIndex((time) => toUtcTimestamp(time) === targetHour);
  if (index < 0 || !Number.isFinite(forecast.rain[index])) return "unavailable";
  return forecast.rain[index]! > 0 ? "rain" : "clear";
}

// Rain adds six minutes only for people exposed to the weather outside a car.
export function rainPenaltyMinutes(mode: TravelMode, status: WeatherStatus) {
  return mode !== "car" && status === "rain" ? RAIN_PENALTY_MINUTES : 0;
}

// Check both possible departure hours; a six-minute adjustment can cross an hour boundary.
export function weatherAroundDeparture(
  forecast: HourlyRainForecast | null,
  baseLeaveAt: string,
  penaltyMinutes: number,
): WeatherStatus {
  const baseStatus = rainAtDeparture(forecast, baseLeaveAt);
  if (penaltyMinutes <= 0) return baseStatus;

  const adjustedLeaveAt = new Date(Date.parse(baseLeaveAt) - penaltyMinutes * 60_000).toISOString();
  const adjustedStatus = rainAtDeparture(forecast, adjustedLeaveAt);
  if (baseStatus === "rain" || adjustedStatus === "rain") return "rain";
  if (baseStatus === "unavailable" || adjustedStatus === "unavailable") return "unavailable";
  return "clear";
}
