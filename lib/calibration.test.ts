import assert from "node:assert/strict";
import test from "node:test";
import { getLearnedSafetyMargin } from "./calibration.ts";

test("waits for five live trip residuals before learning a safety margin", () => {
  assert.equal(getLearnedSafetyMargin([1, 2, 3, 4], "important"), null);
});

test("uses the selected confidence percentile of actual minus predicted", () => {
  const residuals = [5, 1, 4, 2, 3];

  assert.deepEqual(getLearnedSafetyMargin(residuals, "casual"), { minutes: 4, sampleCount: 5 });
  assert.deepEqual(getLearnedSafetyMargin(residuals, "important"), { minutes: 5, sampleCount: 5 });
  assert.deepEqual(getLearnedSafetyMargin(residuals, "critical"), { minutes: 5, sampleCount: 5 });
});

test("learned leave-time margins replace the percentage margin", async () => {
  const { calculateLeaveTime } = await import("./leave-time.ts");
  const plan = calculateLeaveTime({
    arriveBy: "2026-10-31T12:00:00.000Z",
    durationMinutes: 60,
    mode: "car",
    importance: "important",
    learnedSafetyMargin: { minutes: 7, sampleCount: 5 },
  });

  assert.equal(plan.safetyMarginMinutes, 7);
  assert.equal(plan.safetyMarginMethod, "learned");
  assert.equal(plan.safetyMarginSampleCount, 5);
});
