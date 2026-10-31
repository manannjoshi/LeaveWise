import assert from "node:assert/strict";
import test from "node:test";
import { arrivalInMinutes, arriveByValidationError, tomorrowAtNineLocal } from "./date-time.ts";

test("defaults to 9:00 AM tomorrow in local time", () => {
  const now = new Date(2026, 9, 31, 23, 15);
  assert.equal(tomorrowAtNineLocal(now), "2026-11-01T09:00");
});

test("quick arrival presets roll over to the next local day", () => {
  const now = new Date(2026, 9, 31, 23, 45);
  assert.equal(arrivalInMinutes(30, now), "2026-11-01T00:15");
});

test("rejects past and current arrive-by times, and accepts a future time", () => {
  const now = new Date(2026, 9, 31, 12, 0).getTime();

  assert.equal(arriveByValidationError("2026-10-31T11:59", now), "Arrive-by time must be in the future.");
  assert.equal(arriveByValidationError("2026-10-31T12:00", now), "Arrive-by time must be in the future.");
  assert.equal(arriveByValidationError("2026-10-31T12:01", now), "");
});
