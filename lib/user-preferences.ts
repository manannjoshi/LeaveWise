import type { Importance, TravelMode, Place } from "./trip";

const USER_PREFERENCES_KEY = "leavewise-user-preferences-v1";

export type UsualTrip = {
  origin: Place;
  destination: Place;
};

export type UserPreferences = {
  travelMode: TravelMode;
  importance: Importance;
  fixedBuffers: Record<TravelMode, number>;
  usualTrip: UsualTrip | null;
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  travelMode: "car",
  importance: "important",
  fixedBuffers: { car: 8, "two-wheeler": 5, walk: 0 },
  usualTrip: null,
};

export function readUserPreferences(): UserPreferences {
  try {
    const value = localStorage.getItem(USER_PREFERENCES_KEY);
    if (!value) return DEFAULT_USER_PREFERENCES;
    const saved = JSON.parse(value) as Partial<UserPreferences>;
    const mode = isTravelMode(saved.travelMode) ? saved.travelMode : DEFAULT_USER_PREFERENCES.travelMode;
    const importance = isImportance(saved.importance) ? saved.importance : DEFAULT_USER_PREFERENCES.importance;
    const savedBuffers = saved.fixedBuffers;
    const fixedBuffers = { ...DEFAULT_USER_PREFERENCES.fixedBuffers };
    if (savedBuffers) {
      for (const travelMode of ["car", "two-wheeler", "walk"] as const) {
        const buffer = savedBuffers[travelMode];
        if (Number.isFinite(buffer)) fixedBuffers[travelMode] = Math.max(0, Math.min(25, Math.round(buffer)));
      }
    }
    return {
      travelMode: mode,
      importance,
      fixedBuffers,
      usualTrip: isUsualTrip(saved.usualTrip) ? saved.usualTrip : null,
    };
  } catch {
    return DEFAULT_USER_PREFERENCES;
  }
}

export function saveUserPreferences(preferences: UserPreferences) {
  try {
    localStorage.setItem(USER_PREFERENCES_KEY, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}

function isTravelMode(value: unknown): value is TravelMode {
  return value === "car" || value === "two-wheeler" || value === "walk";
}

function isImportance(value: unknown): value is Importance {
  return value === "casual" || value === "important" || value === "critical";
}

function isPlace(value: unknown): value is Place {
  if (!value || typeof value !== "object") return false;
  const place = value as Place;
  return typeof place.label === "string" && Number.isFinite(place.lat) && Number.isFinite(place.lon) &&
    place.lat >= -90 && place.lat <= 90 && place.lon >= -180 && place.lon <= 180;
}

function isUsualTrip(value: unknown): value is UsualTrip {
  if (!value || typeof value !== "object") return false;
  const trip = value as UsualTrip;
  return isPlace(trip.origin) && isPlace(trip.destination);
}
