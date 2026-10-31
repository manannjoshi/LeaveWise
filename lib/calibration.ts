import type { Importance } from "./trip";

export const MIN_CALIBRATION_TRIPS = 5;

const CONFIDENCE_PERCENTILES: Record<Importance, number> = {
  casual: 0.8,
  important: 0.95,
  critical: 0.99,
};

export type LearnedSafetyMargin = {
  minutes: number;
  sampleCount: number;
};

// Ignore malformed history and cap the request payload to the most recent 500 trips.
export function validResidualsFromRequest(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(-500).filter(
    (residual): residual is number => typeof residual === "number" && Number.isFinite(residual) && Math.abs(residual) <= 1440,
  );
}

// Use nearest-rank percentile of actual minus predicted trip durations.
export function getLearnedSafetyMargin(
  residuals: number[],
  importance: Importance,
): LearnedSafetyMargin | null {
  const validResiduals = residuals.filter(Number.isFinite).sort((a, b) => a - b);
  if (validResiduals.length < MIN_CALIBRATION_TRIPS) return null;

  const rank = Math.ceil(CONFIDENCE_PERCENTILES[importance] * validResiduals.length);
  return {
    minutes: Math.ceil(validResiduals[Math.max(0, rank - 1)]),
    sampleCount: validResiduals.length,
  };
}
