import type { DepartureWeather, TravelMode, WeatherIconKind, WeatherStatus } from "./trip";

export const RAIN_PENALTY_MINUTES = 6;

export type HourlyRainForecast = {
  time: string[];
  rain: Array<number | null>;
  weatherCode?: Array<number | null>;
  temperatureC?: Array<number | null>;
  precipitationProbability?: Array<number | null>;
  isDay?: Array<number | null>;
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

function describeWeather(code: number, isDay: boolean): { condition: string; icon: WeatherIconKind } | null {
  if (code === 0) return { condition: isDay ? "Sunny" : "Clear", icon: isDay ? "sun" : "moon" };
  if (code === 1) return { condition: isDay ? "Mostly sunny" : "Mostly clear", icon: isDay ? "sun" : "moon" };
  if (code === 2) return { condition: "Partly cloudy", icon: "partly-cloudy" };
  if (code === 3) return { condition: "Cloudy", icon: "cloudy" };
  if (code === 45 || code === 48) return { condition: "Fog", icon: "fog" };
  if (code === 51) return { condition: "Light drizzle", icon: "drizzle" };
  if (code === 53) return { condition: "Drizzle", icon: "drizzle" };
  if (code === 55) return { condition: "Heavy drizzle", icon: "drizzle" };
  if (code === 56 || code === 57) return { condition: "Freezing drizzle", icon: "drizzle" };
  if (code === 61) return { condition: "Light rain", icon: "rain" };
  if (code === 63) return { condition: "Rain", icon: "rain" };
  if (code === 65) return { condition: "Heavy rain", icon: "rain" };
  if (code === 66 || code === 67) return { condition: "Freezing rain", icon: "rain" };
  if (code === 71) return { condition: "Light snow", icon: "snow" };
  if (code === 73) return { condition: "Snow", icon: "snow" };
  if (code === 75) return { condition: "Heavy snow", icon: "snow" };
  if (code === 77) return { condition: "Snow grains", icon: "snow" };
  if (code === 80) return { condition: "Light rain showers", icon: "rain" };
  if (code === 81) return { condition: "Rain showers", icon: "rain" };
  if (code === 82) return { condition: "Heavy rain showers", icon: "rain" };
  if (code === 85) return { condition: "Light snow showers", icon: "snow" };
  if (code === 86) return { condition: "Heavy snow showers", icon: "snow" };
  if (code === 95) return { condition: "Thunderstorm", icon: "storm" };
  if (code === 96) return { condition: "Thunderstorm with hail", icon: "storm" };
  if (code === 97) return { condition: "Heavy thunderstorm", icon: "storm" };
  if (code === 99) return { condition: "Thunderstorm with heavy hail", icon: "storm" };
  return null;
}

export function weatherAtDeparture(forecast: HourlyRainForecast | null, leaveAt: string): DepartureWeather | null {
  if (!forecast?.weatherCode || !forecast.time.length || forecast.weatherCode.length !== forecast.time.length) return null;
  const departure = Date.parse(leaveAt);
  if (!Number.isFinite(departure)) return null;

  const hourMs = 3_600_000;
  const targetHour = Math.round(departure / hourMs) * hourMs;
  const precipitationHour = Math.ceil(departure / hourMs) * hourMs;
  const index = forecast.time.findIndex((time) => toUtcTimestamp(time) === targetHour);
  if (index < 0) return null;
  const precipitationIndex = forecast.time.findIndex((time) => toUtcTimestamp(time) === precipitationHour);

  const code = forecast.weatherCode[index];
  if (typeof code !== "number" || !Number.isFinite(code)) return null;
  const description = describeWeather(code, forecast.isDay?.[index] !== 0);
  if (!description) return null;

  const temperature = forecast.temperatureC?.[index];
  const probability = precipitationIndex < 0 ? null : forecast.precipitationProbability?.[precipitationIndex];
  return {
    ...description,
    temperatureC: typeof temperature === "number" && Number.isFinite(temperature) ? temperature : null,
    precipitationProbability: typeof probability === "number" && Number.isFinite(probability)
      ? Math.max(0, Math.min(100, probability))
      : null,
  };
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
