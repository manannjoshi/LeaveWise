import assert from "node:assert/strict";
import test from "node:test";
import { calculateLeaveTime } from "./leave-time.ts";
import { rainAtDeparture, rainPenaltyMinutes, weatherAroundDeparture } from "./weather.ts";

const hourly = {
  time: ["2026-10-31T10:00", "2026-10-31T11:00", "2026-10-31T12:00"],
  rain: [0, 0.4, 0],
};

test("reads the hourly rain amount for the hour containing departure", () => {
  assert.equal(rainAtDeparture(hourly, "2026-10-31T10:20:00.000Z"), "rain");
  assert.equal(rainAtDeparture(hourly, "2026-10-31T11:20:00.000Z"), "clear");
});

test("does not invent rain when the forecast hour is missing", () => {
  assert.equal(rainAtDeparture(hourly, "2026-11-01T10:00:00.000Z"), "unavailable");
  assert.equal(rainAtDeparture(null, "2026-10-31T10:00:00.000Z"), "unavailable");
});

test("rain adds six minutes to walking and two-wheeler trips, never cars", () => {
  assert.equal(rainPenaltyMinutes("two-wheeler", "rain"), 6);
  assert.equal(rainPenaltyMinutes("walk", "rain"), 6);
  assert.equal(rainPenaltyMinutes("car", "rain"), 0);
  assert.equal(rainPenaltyMinutes("walk", "clear"), 0);
  assert.equal(rainPenaltyMinutes("walk", "unavailable"), 0);
});

test("the six-minute penalty moves leave time earlier without changing expected route time", () => {
  const plan = calculateLeaveTime({
    arriveBy: "2026-10-31T12:00:00.000Z",
    durationMinutes: 60,
    mode: "walk",
    importance: "casual",
    weatherPenaltyMinutes: 6,
  });

  assert.equal(plan.durationMinutes, 60);
  assert.equal(plan.weatherPenaltyMinutes, 6);
  assert.equal(plan.leaveAt, "2026-10-31T10:51:00.000Z");
});

test("a rain boundary crossed by the penalty is checked too", () => {
  const forecast = {
    time: ["2026-10-31T11:00", "2026-10-31T12:00"],
    rain: [0.2, 0],
  };
  assert.equal(weatherAroundDeparture(forecast, "2026-10-31T11:02:00.000Z", 6), "rain");
});
