import type { Importance, LeavePlan, TravelMode, TripRequest } from "./trip";

export const TRIP_HISTORY_KEY = "leave-on-time-trip-history-v1";
const PLANNED_TRIPS_KEY = "leave-on-time-planned-trips-v1";
const MAX_PLANNED_TRIPS = 50;
export const BASELINE_BUFFER_MINUTES = 10;

export type TripHistoryEntry = {
  id: string;
  arrivedAt: string;
  origin: string;
  originLat: number;
  originLon: number;
  destination: string;
  destinationLat: number;
  destinationLon: number;
  mode: TravelMode;
  importance: Importance;
  confidence: number;
  routingSource: "tomtom" | "mock";
  predictedDurationMinutes: number;
  actualDurationMinutes: number;
  arriveBy: string;
  recommendedLeaveAt: string;
  recommendedAllowanceMinutes: number;
  baselineAllowanceMinutes: number;
  appArrivalErrorMinutes: number;
  baselineArrivalErrorMinutes: number;
  safetyMarginMinutes: number;
  safetyMarginMethod: "percentage" | "learned";
  fixedBufferMinutes: number;
  weatherPenaltyMinutes: number;
};

export type PlannedTripEntry = {
  id: string;
  plannedAt: string;
  trip: TripRequest;
  plan: LeavePlan;
};
export type ActiveTrip = {
  trip: TripRequest;
  plan: LeavePlan;
  startedAt: string;
};

const ACTIVE_TRIP_KEY = "leave-on-time-active-trip-v1";

export function makeTripHistoryEntry(input: {
  trip: TripRequest;
  plan: LeavePlan;
  actualDurationMinutes: number;
  id?: string;
  arrivedAt?: string;
}): TripHistoryEntry {
  const recommendedAllowanceMinutes =
    (Date.parse(input.plan.arriveBy) - Date.parse(input.plan.leaveAt)) / 60_000;
  const baselineAllowanceMinutes = input.plan.durationMinutes + BASELINE_BUFFER_MINUTES;

  return {
    id: input.id ?? crypto.randomUUID(),
    arrivedAt: input.arrivedAt ?? new Date().toISOString(),
    origin: input.trip.origin.label,
    originLat: input.trip.origin.lat,
    originLon: input.trip.origin.lon,
    destination: input.trip.destination.label,
    destinationLat: input.trip.destination.lat,
    destinationLon: input.trip.destination.lon,
    mode: input.trip.mode,
    importance: input.trip.importance,
    confidence: input.plan.confidence,
    routingSource: input.plan.source,
    predictedDurationMinutes: input.plan.durationMinutes,
    actualDurationMinutes: input.actualDurationMinutes,
    arriveBy: input.plan.arriveBy,
    recommendedLeaveAt: input.plan.leaveAt,
    recommendedAllowanceMinutes,
    baselineAllowanceMinutes,
    appArrivalErrorMinutes: input.actualDurationMinutes - recommendedAllowanceMinutes,
    baselineArrivalErrorMinutes: input.actualDurationMinutes - baselineAllowanceMinutes,
    safetyMarginMinutes: input.plan.safetyMarginMinutes,
    safetyMarginMethod: input.plan.safetyMarginMethod,
    fixedBufferMinutes: input.plan.fixedBufferMinutes,
    weatherPenaltyMinutes: input.plan.weatherPenaltyMinutes,
  };
}

export function readPlannedTrips(): PlannedTripEntry[] {
  try {
    const value = localStorage.getItem(PLANNED_TRIPS_KEY);
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter(isPlannedTripEntry) : [];
  } catch {
    return [];
  }
}

export function clearPlannedTrips() {
  try {
    localStorage.removeItem(PLANNED_TRIPS_KEY);
    return true;
  } catch {
    return false;
  }
}

export function clearCompletedTripLogs() {
  try {
    localStorage.removeItem(TRIP_HISTORY_KEY);
    return true;
  } catch {
    return false;
  }
}
export function addPlannedTrip(trip: TripRequest, plan: LeavePlan) {
  try {
    const entry: PlannedTripEntry = {
      id: crypto.randomUUID(),
      plannedAt: new Date().toISOString(),
      trip,
      plan,
    };
    localStorage.setItem(PLANNED_TRIPS_KEY, JSON.stringify([...readPlannedTrips(), entry].slice(-MAX_PLANNED_TRIPS)));
    return true;
  } catch {
    return false;
  }
}

function isPlannedTripEntry(value: unknown): value is PlannedTripEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as PlannedTripEntry;
  const trip = entry.trip;
  const plan = entry.plan;
  return typeof entry.id === "string" && Number.isFinite(Date.parse(entry.plannedAt)) &&
    Boolean(trip && typeof trip.origin?.label === "string" && Number.isFinite(trip.origin.lat) && Number.isFinite(trip.origin.lon) &&
      typeof trip.destination?.label === "string" && Number.isFinite(trip.destination.lat) && Number.isFinite(trip.destination.lon) &&
      Number.isFinite(Date.parse(trip.arriveBy)) && ["car", "two-wheeler", "walk"].includes(trip.mode) &&
      ["casual", "important", "critical"].includes(trip.importance)) &&
    Boolean(plan && Number.isFinite(Date.parse(plan.leaveAt)) && Number.isFinite(Date.parse(plan.arriveBy)) &&
      Number.isFinite(plan.durationMinutes) && Number.isFinite(plan.safetyMarginMinutes) &&
      Number.isFinite(plan.fixedBufferMinutes) && Number.isFinite(plan.weatherPenaltyMinutes) &&
      Number.isFinite(plan.confidence) && (plan.source === "tomtom" || plan.source === "mock"));
}
export function readActiveTrip(): ActiveTrip | null {
  try {
    const value = localStorage.getItem(ACTIVE_TRIP_KEY);
    if (!value) return null;
    const saved = JSON.parse(value) as ActiveTrip;
    if (!saved.startedAt || !Number.isFinite(Date.parse(saved.startedAt)) || !saved.trip?.origin || !saved.plan?.leaveAt) return null;
    return saved;
  } catch {
    return null;
  }
}

export function saveActiveTrip(trip: ActiveTrip) {
  try {
    localStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(trip));
    return true;
  } catch {
    return false;
  }
}

export function clearActiveTrip() {
  try {
    localStorage.removeItem(ACTIVE_TRIP_KEY);
  } catch {
    // The UI can still finish the timer if storage is unavailable.
  }
}

export function readTripHistory(): TripHistoryEntry[] {
  try {
    const value = localStorage.getItem(TRIP_HISTORY_KEY);
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter(isTripHistoryEntry) : [];
  } catch {
    return [];
  }
}

export function addTripHistoryEntry(entry: TripHistoryEntry) {
  try {
    localStorage.setItem(TRIP_HISTORY_KEY, JSON.stringify([...readTripHistory(), entry]));
    return true;
  } catch {
    return false;
  }
}

export function getCalibrationResiduals(entries: TripHistoryEntry[]) {
  return entries
    .filter((entry) => entry.routingSource === "tomtom")
    .map((entry) => entry.actualDurationMinutes - entry.predictedDurationMinutes);
}

function isTripHistoryEntry(value: unknown): value is TripHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as TripHistoryEntry;
  return typeof entry.id === "string" && typeof entry.arrivedAt === "string" &&
    typeof entry.origin === "string" && typeof entry.destination === "string" &&
    Number.isFinite(entry.originLat) && Number.isFinite(entry.originLon) &&
    Number.isFinite(entry.destinationLat) && Number.isFinite(entry.destinationLon) &&
    ["car", "two-wheeler", "walk"].includes(entry.mode) &&
    ["casual", "important", "critical"].includes(entry.importance) &&
    ["tomtom", "mock"].includes(entry.routingSource) &&
    ["percentage", "learned"].includes(entry.safetyMarginMethod) &&
    typeof entry.arriveBy === "string" && typeof entry.recommendedLeaveAt === "string" &&
    Number.isFinite(entry.confidence) && Number.isFinite(entry.predictedDurationMinutes) &&
    Number.isFinite(entry.actualDurationMinutes) && Number.isFinite(entry.recommendedAllowanceMinutes) &&
    Number.isFinite(entry.baselineAllowanceMinutes) && Number.isFinite(entry.appArrivalErrorMinutes) &&
    Number.isFinite(entry.baselineArrivalErrorMinutes) && Number.isFinite(entry.safetyMarginMinutes) &&
    Number.isFinite(entry.fixedBufferMinutes) && Number.isFinite(entry.weatherPenaltyMinutes);
}
