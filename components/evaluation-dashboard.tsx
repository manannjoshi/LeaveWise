"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { calculateEvaluation, tripHistoryToCsv } from "@/lib/evaluation";
import { readTripHistory } from "@/lib/trip-history";
import type { TripHistoryEntry } from "@/lib/trip-history";

function formatRate(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function formatError(value: number | null) {
  if (value === null) return "—";
  const rounded = value.toFixed(1);
  return `${value > 0 ? "+" : ""}${rounded} min`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function EvaluationDashboard() {
  const [entries, setEntries] = useState<TripHistoryEntry[]>([]);

  useEffect(() => {
    setEntries(readTripHistory());
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
    <main className="min-h-screen px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm font-semibold text-emerald-800 underline underline-offset-4">← Back to trip planner</Link>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">Leave On Time</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Trip evaluation</h1>
            <p className="mt-2 max-w-2xl text-slate-600">Compare the app recommendation with raw ETA + 10 minutes using the actual duration you logged.</p>
          </div>
          <button type="button" onClick={exportCsv} disabled={!entries.length} className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
            Export CSV
          </button>
        </div>

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
        <p className="mt-2 text-xs text-slate-500">Logs are stored in this browser only. Use Export CSV to save a report or backup.</p>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
            <h2 className="font-semibold">Completed trip logs ({entries.length})</h2>
          </div>
          {entries.length === 0 ? (
            <p className="px-4 py-8 text-sm text-slate-600 sm:px-6">No trips logged yet. Plan a trip, enter its actual duration after arriving, and press “I arrived.”</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Arrived</th>
                    <th className="px-4 py-3">Trip</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3">Predicted / actual</th>
                    <th className="px-4 py-3">App error</th>
                    <th className="px-4 py-3">Baseline error</th>
                    <th className="px-4 py-3">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {[...entries].reverse().map((entry) => (
                    <tr key={entry.id} className="border-t border-slate-100">
                      <td className="whitespace-nowrap px-4 py-3">{formatDate(entry.arrivedAt)}</td>
                      <td className="px-4 py-3">{entry.origin} → {entry.destination}</td>
                      <td className="px-4 py-3">{entry.mode}</td>
                      <td className="whitespace-nowrap px-4 py-3">{entry.predictedDurationMinutes} / {entry.actualDurationMinutes} min</td>
                      <td className="whitespace-nowrap px-4 py-3">{formatError(entry.appArrivalErrorMinutes)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{formatError(entry.baselineArrivalErrorMinutes)}</td>
                      <td className="px-4 py-3">{entry.routingSource === "tomtom" ? "Live" : "Sample"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}
