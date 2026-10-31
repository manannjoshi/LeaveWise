"use client";

import { useEffect, useState } from "react";
import { calculateEvaluation, tripHistoryToCsv } from "@/lib/evaluation";
import { readPlannedTrips, readTripHistory } from "@/lib/trip-history";
import type { PlannedTripEntry, TripHistoryEntry } from "@/lib/trip-history";

function formatRate(value: number | null) {
  return value === null ? "Not available" : `${value.toFixed(1)}%`;
}

function formatError(value: number | null) {
  if (value === null) return "Not available";
  const rounded = value.toFixed(1);
  return `${value > 0 ? "+" : ""}${rounded} min`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function EvaluationDashboard() {
  const [entries, setEntries] = useState<TripHistoryEntry[]>([]);
  const [plannedTrips, setPlannedTrips] = useState<PlannedTripEntry[]>([]);

  useEffect(() => {
    setEntries(readTripHistory());
    setPlannedTrips(readPlannedTrips());
  }, []);

  const metrics = calculateEvaluation(entries);

  function exportCsv() {
    if (!entries.length) return;
    const blob = new Blob([tripHistoryToCsv(entries)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `leave-on-time-trip-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main className="px-4 py-5">
      <div className="mx-auto max-w-5xl">
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="mt-2">Trips</h1>
            <p className="mt-2 max-w-2xl text-slate-600">Compare the app recommendation with raw ETA + 10 minutes using the actual duration you logged.</p>
          </div>
          <button type="button" onClick={exportCsv} disabled={!entries.length} className="min-h-11 bg-emerald-900 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
            Export CSV
          </button>
        </div>

        <section className="mt-6 overflow-hidden rounded-2xl bg-white" aria-label="Planned trips">
          <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
            <h2 className="font-semibold">Planned trips ({plannedTrips.length})</h2>
          </div>
          {plannedTrips.length === 0 ? (
            <p className="px-4 py-8 text-sm text-slate-600 sm:px-6">Trips you calculate will appear here.</p>
          ) : (
            <ul>
              {[...plannedTrips].reverse().map((entry) => (
                <li key={entry.id} className="border-t border-slate-200 px-4 py-4 sm:px-6">
                  <p className="font-semibold">{entry.trip.origin.label} → {entry.trip.destination.label}</p>
                  <p className="mt-1 text-sm text-slate-500">{formatDate(entry.plannedAt)} · {entry.trip.mode} · {entry.plan.source === "tomtom" ? "Live estimate" : "Sample estimate"}</p>
                  <p className="mt-2 text-sm">Leave at {formatTime(entry.plan.leaveAt)} · arrive by {formatTime(entry.trip.arriveBy)}</p>
                  <p className="mt-1 text-sm text-slate-500">{entry.plan.durationMinutes} min expected travel</p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-label="Evaluation metrics" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="App on-time rate" value={formatRate(metrics.appOnTimeRate)} />
          <Metric label="Baseline on-time rate" value={formatRate(metrics.baselineOnTimeRate)} />
          <Metric label="App mean arrival error" value={formatError(metrics.appMeanArrivalErrorMinutes)} />
          <Metric label="Baseline mean arrival error" value={formatError(metrics.baselineMeanArrivalErrorMinutes)} />
        </section>

        <p className="mt-4 text-sm text-slate-600">
          Compared {metrics.liveTripCount} completed live-routing trip{metrics.liveTripCount === 1 ? "" : "s"}.
          {metrics.excludedMockCount > 0 && ` ${metrics.excludedMockCount} sample-route log${metrics.excludedMockCount === 1 ? " was" : "s were"} excluded from the raw-API baseline.`}
          {" "}Arrival error is actual duration minus the time budget each recommendation allowed; positive means late, zero or negative means on time. This comparison assumes each strategy starts at its recommended time and the logged duration applies.
        </p>
        <p className="mt-2 text-sm text-slate-500">Planned trips and completed logs are stored on this device. Use Export CSV to save completed logs.</p>

        <section className="mt-6 overflow-hidden rounded-2xl bg-white">
          <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
            <h2 className="font-semibold">Completed trip logs ({entries.length})</h2>
          </div>
          {entries.length === 0 ? (
            <p className="px-4 py-8 text-sm text-slate-600 sm:px-6">No trips logged yet. Plan a trip, enter its actual duration after arriving, and press “I arrived.”</p>
          ) : (
            <ul>
              {[...entries].reverse().map((entry) => (
                <li key={entry.id} className="border-t border-slate-200 px-4 py-4 sm:px-6">
                  <p className="font-semibold">{entry.origin} → {entry.destination}</p>
                  <p className="mt-1 text-sm text-slate-500">{formatDate(entry.arrivedAt)} | {entry.mode} | {entry.routingSource === "tomtom" ? "Live" : "Sample"}</p>
                  <div className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-slate-500">Predicted / actual</span><span>{entry.predictedDurationMinutes} / {entry.actualDurationMinutes} min</span>
                    <span className="text-slate-500">App arrival error</span><span>{formatError(entry.appArrivalErrorMinutes)}</span>
                    <span className="text-slate-500">Baseline error</span><span>{formatError(entry.baselineArrivalErrorMinutes)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}
