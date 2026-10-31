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

const CSV_COLUMNS: Array<[string, (entry: TripHistoryEntry) => string | number]> = [
  ["Arrived at", (entry) => entry.arrivedAt],
  ["Origin", (entry) => entry.origin],
  ["Destination", (entry) => entry.destination],
  ["Mode", (entry) => entry.mode],
  ["Importance", (entry) => entry.importance],
  ["Confidence (%)", (entry) => entry.confidence],
  ["Routing source", (entry) => entry.routingSource],
  ["Predicted duration (min)", (entry) => entry.predictedDurationMinutes],
  ["Actual duration (min)", (entry) => entry.actualDurationMinutes],
  ["Safety margin (min)", (entry) => entry.safetyMarginMinutes],
  ["Safety margin method", (entry) => entry.safetyMarginMethod],
  ["Fixed buffer (min)", (entry) => entry.fixedBufferMinutes],
  ["Rain adjustment (min)", (entry) => entry.weatherPenaltyMinutes],
  ["App recommended leave at", (entry) => entry.recommendedLeaveAt],
  ["App allowance (min)", (entry) => entry.recommendedAllowanceMinutes.toFixed(2)],
  ["App arrival error (min)", (entry) => entry.appArrivalErrorMinutes.toFixed(2)],
  ["App on time", (entry) => entry.appArrivalErrorMinutes <= 0 ? "yes" : "no"],
  ["Raw ETA (min)", (entry) => entry.predictedDurationMinutes],
  ["Baseline fixed buffer (min)", () => 10],
  ["Baseline allowance (min)", (entry) => entry.baselineAllowanceMinutes],
  ["Baseline arrival error (min)", (entry) => entry.baselineArrivalErrorMinutes.toFixed(2)],
  ["Baseline on time", (entry) => entry.baselineArrivalErrorMinutes <= 0 ? "yes" : "no"],
];

function csvCell(value: string | number) {
  const text = typeof value === "string" && /^[=+@\-]/.test(value) ? `'${value}` : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function tripHistoryToCsv(entries: TripHistoryEntry[]) {
  const header = CSV_COLUMNS.map(([name]) => csvCell(name)).join(",");
  const rows = entries.map((entry) => CSV_COLUMNS.map(([, getValue]) => csvCell(getValue(entry))).join(","));
  return `\uFEFF${[header, ...rows].join("\r\n")}`;
}
