import assert from "node:assert/strict";
import test from "node:test";
import { calculateLeaveTime } from "./leave-time.ts";
import type { Importance, TravelMode } from "./trip";

// The mocked duration provider stands in for routing without using the network.
async function planWithMockRouting(
  arriveBy: string,
  mode: TravelMode,
  importance: Importance,
  getDuration: () => Promise<number>,
) {
  const durationMinutes = await getDuration();
  return calculateLeaveTime({ arriveBy, durationMinutes, mode, importance });
}

test("critical trips add a 30% safety margin and the car buffer", async () => {
  const plan = await planWithMockRouting(
    "2026-10-31T12:00:00.000Z",
    "car",
    "critical",
    async () => 60,
  );

  assert.equal(plan.durationMinutes, 60);
  assert.equal(plan.safetyMarginMinutes, 18);
  assert.equal(plan.fixedBufferMinutes, 8);
  assert.equal(plan.confidence, 99);
  assert.equal(plan.leaveAt, "2026-10-31T10:34:00.000Z");
});

test("walk uses no fixed buffer and rounds its safety margin up", async () => {
  const plan = await planWithMockRouting(
    "2026-10-31T12:00:00.000Z",
    "walk",
    "casual",
    async () => 31,
  );

  assert.equal(plan.safetyMarginMinutes, 2);
  assert.equal(plan.fixedBufferMinutes, 0);
  assert.equal(plan.confidence, 80);
});

test("important and critical trips keep at least three minutes of safety margin", () => {
  const important = calculateLeaveTime({
    arriveBy: "2026-10-31T12:00:00.000Z",
    durationMinutes: 10,
    mode: "walk",
    importance: "important",
  });
  const critical = calculateLeaveTime({
    arriveBy: "2026-10-31T12:00:00.000Z",
    durationMinutes: 5,
    mode: "walk",
    importance: "critical",
  });

  assert.equal(important.safetyMarginMinutes, 3);
  assert.equal(critical.safetyMarginMinutes, 3);
});

test("casual trips keep the percentage margin without a three-minute minimum", () => {
  const plan = calculateLeaveTime({
    arriveBy: "2026-10-31T12:00:00.000Z",
    durationMinutes: 10,
    mode: "walk",
    importance: "casual",
  });

  assert.equal(plan.safetyMarginMinutes, 1);
});
