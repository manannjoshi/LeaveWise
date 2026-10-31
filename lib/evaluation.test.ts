import assert from "node:assert/strict";
import test from "node:test";
import { calculateEvaluation, tripHistoryToCsv } from "./evaluation.ts";
import type { TripHistoryEntry } from "./trip-history.ts";

function sampleEntry(overrides: Partial<TripHistoryEntry> = {}): TripHistoryEntry {
  return {
    id: "trip-1",
    arrivedAt: "2026-10-31T10:00:00.000Z",
    origin: "Start",
    destination: "Finish",
    mode: "car",
    importance: "important",
    confidence: 95,
    routingSource: "tomtom",
    originLat: 1,
    originLon: 1,
    destinationLat: 2,
    destinationLon: 2,
    predictedDurationMinutes: 30,
    actualDurationMinutes: 35,
    arriveBy: "2026-10-31T11:00:00.000Z",
    recommendedLeaveAt: "2026-10-31T10:10:00.000Z",
    recommendedAllowanceMinutes: 50,
    baselineAllowanceMinutes: 40,
    appArrivalErrorMinutes: -15,
    baselineArrivalErrorMinutes: -5,
    safetyMarginMinutes: 10,
    safetyMarginMethod: "percentage",
    fixedBufferMinutes: 8,
    weatherPenaltyMinutes: 0,
    ...overrides,
  };
}

test("compares live route logs and excludes mocked routes from the API baseline", () => {
  const metrics = calculateEvaluation([
    sampleEntry(),
    sampleEntry({ id: "trip-2", appArrivalErrorMinutes: 5, baselineArrivalErrorMinutes: 15 }),
    sampleEntry({ id: "mock", routingSource: "mock" }),
  ]);

  assert.equal(metrics.liveTripCount, 2);
  assert.equal(metrics.excludedMockCount, 1);
  assert.equal(metrics.appOnTimeRate, 50);
  assert.equal(metrics.baselineOnTimeRate, 50);
  assert.equal(metrics.appMeanArrivalErrorMinutes, -5);
  assert.equal(metrics.baselineMeanArrivalErrorMinutes, 5);
});

test("exports all trip logs as escaped CSV", () => {
  const csv = tripHistoryToCsv([sampleEntry({ origin: 'Hall, "A"' })]);
  assert.match(csv, /"Hall, ""A"""/);
  assert.match(csv, /"Raw ETA \(min\)","Baseline fixed buffer \(min\)"/);
});
