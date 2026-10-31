import assert from "node:assert/strict";
import test from "node:test";
import { makeTripHistoryEntry } from "./trip-history.ts";

test("stores actual and predicted duration plus app and baseline arrival error", () => {
  const entry = makeTripHistoryEntry({
    id: "test-trip",
    arrivedAt: "2026-10-31T11:00:00.000Z",
    trip: {
      origin: { label: "Start", lat: 1, lon: 1 },
      destination: { label: "Finish", lat: 2, lon: 2 },
      arriveBy: "2026-10-31T12:00:00.000Z",
      mode: "car",
      importance: "important",
    },
    plan: {
      leaveAt: "2026-10-31T10:40:00.000Z",
      arriveBy: "2026-10-31T12:00:00.000Z",
      durationMinutes: 60,
      safetyMarginMinutes: 10,
      fixedBufferMinutes: 8,
      weatherPenaltyMinutes: 0,
      weatherStatus: "clear",
      safetyMarginMethod: "percentage",
      safetyMarginSampleCount: 0,
      confidence: 95,
      explanation: "test",
      source: "tomtom",
    },
    actualDurationMinutes: 75,
  });

  assert.equal(entry.predictedDurationMinutes, 60);
  assert.equal(entry.actualDurationMinutes, 75);
  assert.equal(entry.appArrivalErrorMinutes, -5);
  assert.equal(entry.baselineAllowanceMinutes, 70);
  assert.equal(entry.baselineArrivalErrorMinutes, 5);
});
