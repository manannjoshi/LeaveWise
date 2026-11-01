"use client";

import { useEffect, useState } from "react";
import { clearCompletedTripLogs, clearPlannedTrips, readPlannedTrips, readTripHistory } from "@/lib/trip-history";
import { DEFAULT_USER_PREFERENCES, readUserPreferences, saveUserPreferences } from "@/lib/user-preferences";
import type { UserPreferences } from "@/lib/user-preferences";
import type { Importance, TravelMode } from "@/lib/trip";

const travelModes: Array<{ value: TravelMode; label: string }> = [
  { value: "car", label: "Car" },
  { value: "two-wheeler", label: "Two-wheeler" },
  { value: "walk", label: "Walk" },
];

const timingTargets: Array<{ value: Importance; label: string; detail: string }> = [
  { value: "casual", label: "Relaxed", detail: "80% target" },
  { value: "important", label: "Important", detail: "95% target" },
  { value: "critical", label: "Must be on time", detail: "99% target" },
];

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [plannedCount, setPlannedCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setPreferences(readUserPreferences());
    refreshCounts();
  }, []);

  function refreshCounts() {
    setPlannedCount(readPlannedTrips().length);
    setCompletedCount(readTripHistory().length);
  }

  function updatePreferences(next: UserPreferences) {
    setPreferences(next);
    setMessage(saveUserPreferences(next) ? "Saved on this device." : "Could not save on this device.");
  }

  function updateMode(travelMode: TravelMode) {
    updatePreferences({ ...preferences, travelMode });
  }

  function updateImportance(importance: Importance) {
    updatePreferences({ ...preferences, importance });
  }

  function updateBuffer(buffer: number) {
    updatePreferences({
      ...preferences,
      fixedBuffers: { ...preferences.fixedBuffers, [preferences.travelMode]: buffer },
    });
  }

  function clearPlans() {
    if (!window.confirm("Clear all planned trips saved on this device?")) return;
    if (clearPlannedTrips()) {
      refreshCounts();
      setMessage("Planned trips cleared.");
    } else {
      setMessage("Could not clear planned trips.");
    }
  }

  function clearCompletedLogs() {
    if (!window.confirm("Clear completed trip logs? This also resets your learned trip estimates.")) return;
    if (clearCompletedTripLogs()) {
      refreshCounts();
      setMessage("Completed trip logs cleared.");
    } else {
      setMessage("Could not clear completed trip logs.");
    }
  }

  const buffer = preferences.fixedBuffers[preferences.travelMode];

  return (
    <main className="px-4 py-5">
      <h1 className="mt-3">Settings</h1>

      <section className="settings-section mt-6 rounded-2xl bg-white p-4 sm:p-5" aria-labelledby="defaults-heading">
        <h2 id="defaults-heading" className="text-lg font-semibold">My defaults</h2>

        <div className="settings-control mt-5">
          <p className="settings-label" id="travel-mode-label">Usual way to travel</p>
          <div className="settings-choice-grid" role="group" aria-labelledby="travel-mode-label">
            {travelModes.map((mode) => (
              <SettingsChoice key={mode.value} label={mode.label} selected={preferences.travelMode === mode.value} onClick={() => updateMode(mode.value)} />
            ))}
          </div>
        </div>

        <div className="settings-control mt-5">
          <p className="settings-label" id="timing-target-label">How important is being on time?</p>
          <div className="settings-choice-grid" role="group" aria-labelledby="timing-target-label">
            {timingTargets.map((target) => (
              <SettingsChoice key={target.value} label={target.label} detail={target.detail} selected={preferences.importance === target.value} onClick={() => updateImportance(target.value)} />
            ))}
          </div>
        </div>

        <div className="settings-control mt-5">
          <div className="buffer-control-heading">
            <label htmlFor="default-buffer">Extra time for {travelModes.find((mode) => mode.value === preferences.travelMode)?.label.toLowerCase()}</label>
            <output htmlFor="default-buffer">{buffer} min</output>
          </div>
          <div className="buffer-slider-row">
            <button type="button" className="buffer-step-button" aria-label="Reduce extra time" disabled={buffer <= 0} onClick={() => updateBuffer(Math.max(0, buffer - 1))}>−</button>
            <input id="default-buffer" className="buffer-range" type="range" min="0" max="25" step="1" value={buffer} aria-valuetext={`${buffer} minutes extra time`} onChange={(event) => updateBuffer(Number(event.target.value))} />
            <button type="button" className="buffer-step-button" aria-label="Add extra time" disabled={buffer >= 25} onClick={() => updateBuffer(Math.min(25, buffer + 1))}>+</button>
          </div>
        </div>
      </section>

      {preferences.usualTrip && (
        <section className="settings-section mt-4 rounded-2xl bg-white p-4 sm:p-5" aria-labelledby="usual-trip-heading">
          <h2 id="usual-trip-heading" className="text-lg font-semibold">My usual trip</h2>
          <p className="mt-2 font-medium">{preferences.usualTrip.origin.label} → {preferences.usualTrip.destination.label}</p>
          <button type="button" className="settings-secondary-button mt-3" onClick={() => updatePreferences({ ...preferences, usualTrip: null })}>Remove usual trip</button>
        </section>
      )}

      <section className="settings-section mt-4 rounded-2xl bg-white p-4 sm:p-5" aria-labelledby="trip-data-heading">
        <h2 id="trip-data-heading" className="text-lg font-semibold">My trip data</h2>
        <p className="mt-2 text-sm text-slate-500">Saved on this device only.</p>
        <div className="settings-data-row">
          <span>Planned trips</span><span>{plannedCount}</span>
          <button type="button" className="settings-secondary-button" disabled={!plannedCount} onClick={clearPlans}>Clear</button>
        </div>
        <div className="settings-data-row">
          <span>Completed trip logs</span><span>{completedCount}</span>
          <button type="button" className="settings-secondary-button" disabled={!completedCount} onClick={clearCompletedLogs}>Clear</button>
        </div>
      </section>

      {message && <p role="status" className="mt-3 text-sm text-slate-500">{message}</p>}
    </main>
  );
}

function SettingsChoice({ label, detail, selected, onClick }: { label: string; detail?: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" className="settings-choice" aria-pressed={selected} onClick={onClick}>
      <span>{label}</span>
      {detail && <span className="settings-choice-detail">{detail}</span>}
    </button>
  );
}
