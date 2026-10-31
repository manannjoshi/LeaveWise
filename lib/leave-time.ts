import type { Importance, TravelMode } from "./trip";

const DEFAULT_BUFFERS: Record<TravelMode, number> = {
  car: 8,
  "two-wheeler": 5,
  walk: 0,
};

const SAFETY_RATES: Record<Importance, number> = {
  casual: 0.05,
  important: 0.15,
  critical: 0.30,
};

// Important and critical trips always get at least three minutes of safety time.
export const MIN_SAFETY_MARGIN_MINUTES = 3;

const CONFIDENCE: Record<Importance, number> = {
  casual: 80,
  important: 95,
  critical: 99,
};

// Pure calculation: the same inputs always give the same leave time.
export function calculateLeaveTime(input: {
  arriveBy: string;
  durationMinutes: number;
  mode: TravelMode;
  importance: Importance;
  fixedBufferMinutes?: number;
  weatherPenaltyMinutes?: number;
  learnedSafetyMargin?: { minutes: number; sampleCount: number };
}) {
  const fixedBufferMinutes = input.fixedBufferMinutes ?? DEFAULT_BUFFERS[input.mode];
  const weatherPenaltyMinutes = input.weatherPenaltyMinutes ?? 0;
  const percentageMargin = Math.ceil(input.durationMinutes * SAFETY_RATES[input.importance]);
  const safetyMarginMinutes = input.learnedSafetyMargin
    ? Math.ceil(input.learnedSafetyMargin.minutes)
    : input.importance === "casual"
      ? percentageMargin
      : Math.max(percentageMargin, MIN_SAFETY_MARGIN_MINUTES);
  const leaveAt = new Date(
    new Date(input.arriveBy).getTime() -
      (input.durationMinutes + safetyMarginMinutes + fixedBufferMinutes + weatherPenaltyMinutes) * 60_000,
  );

  return {
    leaveAt: leaveAt.toISOString(),
    durationMinutes: Math.ceil(input.durationMinutes),
    safetyMarginMinutes,
    fixedBufferMinutes,
    weatherPenaltyMinutes,
    safetyMarginMethod: input.learnedSafetyMargin ? "learned" as const : "percentage" as const,
    safetyMarginSampleCount: input.learnedSafetyMargin?.sampleCount ?? 0,
    confidence: CONFIDENCE[input.importance],
  };
}

// Keeps travel-mode conversions in one place at the TomTom API boundary.
export function toTomTomTravelMode(mode: TravelMode) {
  return mode === "two-wheeler" ? "motorcycle" : mode === "walk" ? "pedestrian" : "car";
}

export function defaultBuffer(mode: TravelMode) {
  return DEFAULT_BUFFERS[mode];
}
