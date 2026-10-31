import type { TripHistoryEntry } from "./trip-history";

export type EvaluationMetrics = {
  liveTripCount: number;
  excludedMockCount: number;
  appOnTimeRate: number | null;
  baselineOnTimeRate: number | null;
  appMeanArrivalErrorMinutes: number | null;
  baselineMeanArrivalErrorMinutes: number | null;
};

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function calculateEvaluation(entries: TripHistoryEntry[]): EvaluationMetrics {
  const live = entries.filter((entry) => entry.routingSource === "tomtom");
  const appErrors = live.map((entry) => entry.appArrivalErrorMinutes);
  const baselineErrors = live.map((entry) => entry.baselineArrivalErrorMinutes);

  return {
    liveTripCount: live.length,
    excludedMockCount: entries.length - live.length,
    appOnTimeRate: live.length ? live.filter((entry) => entry.appArrivalErrorMinutes <= 0).length / live.length * 100 : null,
    baselineOnTimeRate: live.length ? live.filter((entry) => entry.baselineArrivalErrorMinutes <= 0).length / live.length * 100 : null,
    appMeanArrivalErrorMinutes: mean(appErrors),
    baselineMeanArrivalErrorMinutes: mean(baselineErrors),
  };
}
