import { calculateLeaveTime, defaultBuffer, toTomTomTravelMode } from "@/lib/leave-time";
import type { LearnedSafetyMargin } from "@/lib/calibration";
import { rainAtDeparture, rainPenaltyMinutes, weatherAroundDeparture } from "@/lib/weather";
import type { HourlyRainForecast } from "@/lib/weather";
import type { Importance, LeavePlan, Place, TravelMode, TripRequest, WeatherStatus } from "@/lib/trip";

function mockDurationMinutes(origin: Place, destination: Place, mode: TravelMode) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = radians(origin.lat);
  const lat2 = radians(destination.lat);
  const deltaLat = lat2 - lat1;
  const deltaLon = radians(destination.lon - origin.lon);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const speedKmh = mode === "walk" ? 5 : mode === "two-wheeler" ? 25 : 30;
  return Math.max(5, (distanceKm / speedKmh) * 60 * 1.25);
}

async function getTomTomDuration(input: TripRequest, departAt: string, key: string) {
  const locations = `${input.origin.lat},${input.origin.lon}:${input.destination.lat},${input.destination.lon}`;
  const url = new URL(`https://api.tomtom.com/routing/1/calculateRoute/${locations}/json`);
  url.searchParams.set("key", key);
  url.searchParams.set("departAt", departAt);
  url.searchParams.set("traffic", "true");
  url.searchParams.set("travelMode", toTomTomTravelMode(input.mode));
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error("TomTom Routing request failed");
  const data = await response.json();
  const seconds = data.routes?.[0]?.summary?.travelTimeInSeconds;
  if (!Number.isFinite(seconds)) throw new Error("TomTom returned no route duration");
  return seconds / 60;
}

async function getOpenMeteoRain(origin: Place): Promise<HourlyRainForecast | null> {
  if (origin.label.toLowerCase().endsWith("(sample location)")) return null;

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(origin.lat));
    url.searchParams.set("longitude", String(origin.lon));
    url.searchParams.set("hourly", "rain,showers");
    url.searchParams.set("timezone", "GMT");
    url.searchParams.set("forecast_days", "16");
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return null;

    const data = await response.json();
    const time = data.hourly?.time;
    const rain = data.hourly?.rain;
    const showers = data.hourly?.showers;
    if (!Array.isArray(time) || !Array.isArray(rain) || !Array.isArray(showers) ||
        !time.every((value: unknown) => typeof value === "string") ||
        rain.length !== time.length || showers.length !== time.length) return null;

    return {
      time,
      // Add rain and showers but leave snow out of this rain-only adjustment.
      rain: rain.map((value: unknown, index: number) => {
        const shower = showers[index];
        return typeof value === "number" && Number.isFinite(value) &&
          typeof shower === "number" && Number.isFinite(shower) ? value + shower : null;
      }),
    };
  } catch {
    return null;
  }
}

function weatherExplanation(status: WeatherStatus, mode: TravelMode, penalty: number, routeSource: "tomtom" | "mock") {
  if (status === "unavailable") return "Weather forecast unavailable; no rain adjustment was added.";
  if (status === "clear") return "No rain forecast near departure.";
  if (mode === "car") {
    return routeSource === "tomtom"
      ? "Rain forecast near departure; no extra car time added because live traffic is used."
      : "Rain forecast near departure; no extra car time added.";
  }
  return `Rain forecast near departure, added ${penalty} min.`;
}

export async function planTrip(trip: TripRequest, learnedSafetyMargin?: LearnedSafetyMargin | null): Promise<LeavePlan> {
  const buffer = trip.fixedBufferMinutes ?? defaultBuffer(trip.mode);
  const key = process.env.TOMTOM_API_KEY;
  let source: "tomtom" | "mock" = key ? "tomtom" : "mock";
  let durationMinutes: number;

  try {
    if (!key) throw new Error("No TomTom key is configured");
    let guess = new Date(Date.parse(trip.arriveBy) - (30 + buffer) * 60_000);
    durationMinutes = 0;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      durationMinutes = await getTomTomDuration(trip, guess.toISOString(), key);
      const estimate = calculateLeaveTime({ ...trip, durationMinutes, fixedBufferMinutes: buffer, learnedSafetyMargin: learnedSafetyMargin ?? undefined });
      guess = new Date(estimate.leaveAt);
    }
  } catch {
    source = "mock";
    durationMinutes = mockDurationMinutes(trip.origin, trip.destination, trip.mode);
  }

  const effectiveMargin = source === "tomtom" ? learnedSafetyMargin ?? undefined : undefined;
  const basePlan = calculateLeaveTime({ ...trip, durationMinutes, fixedBufferMinutes: buffer, learnedSafetyMargin: effectiveMargin });
  const forecast = await getOpenMeteoRain(trip.origin);
  let weatherStatus = rainAtDeparture(forecast, basePlan.leaveAt);
  let weatherPenaltyMinutes = rainPenaltyMinutes(trip.mode, weatherStatus);
  if (weatherPenaltyMinutes > 0) {
    weatherStatus = weatherAroundDeparture(forecast, basePlan.leaveAt, weatherPenaltyMinutes);
    weatherPenaltyMinutes = rainPenaltyMinutes(trip.mode, weatherStatus);
  }

  const plan = calculateLeaveTime({
    ...trip,
    durationMinutes,
    fixedBufferMinutes: buffer,
    weatherPenaltyMinutes,
    learnedSafetyMargin: effectiveMargin,
  });
  const weatherEffect = weatherExplanation(weatherStatus, trip.mode, weatherPenaltyMinutes, source);
  return {
    ...plan,
    arriveBy: trip.arriveBy,
    explanation: `${plan.durationMinutes} min travel + ${plan.safetyMarginMinutes} min ${plan.safetyMarginMethod} safety + ${plan.fixedBufferMinutes} min ${trip.mode} buffer. ${weatherEffect}`,
    source,
    weatherStatus,
  };
}
