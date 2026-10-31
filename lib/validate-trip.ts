import type { Importance, Place, TravelMode, TripRequest } from "./trip";

const modes: TravelMode[] = ["car", "two-wheeler", "walk"];
const importances: Importance[] = ["casual", "important", "critical"];

function isPlace(value: unknown): value is Place {
  if (!value || typeof value !== "object") return false;
  const place = value as Place;
  return typeof place.label === "string" && place.label.length > 0 && place.label.length <= 300 &&
    Number.isFinite(place.lat) && place.lat >= -90 && place.lat <= 90 &&
    Number.isFinite(place.lon) && place.lon >= -180 && place.lon <= 180;
}

export function isTripRequest(value: unknown): value is TripRequest {
  if (!value || typeof value !== "object") return false;
  const trip = value as Partial<TripRequest>;
  if (!isPlace(trip.origin) || !isPlace(trip.destination) ||
      typeof trip.arriveBy !== "string" || !Number.isFinite(Date.parse(trip.arriveBy)) ||
      !modes.includes(trip.mode as TravelMode) || !importances.includes(trip.importance as Importance)) return false;

  return trip.fixedBufferMinutes === undefined ||
    (Number.isFinite(trip.fixedBufferMinutes) && trip.fixedBufferMinutes >= 0 && trip.fixedBufferMinutes <= 180);
}
