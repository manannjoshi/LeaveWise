"use client";

import { useEffect, useState, type ReactNode } from "react";
import { calculateEvaluation } from "@/lib/evaluation";
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

  return (
    <main className="px-4 py-5">
      <div className="mx-auto max-w-5xl">
        <div className="mt-6">
          <div>
            <h1 className="mt-2">Trips</h1>
          </div>
        </div>

        <DisclosureSection title={`Planned trips (${plannedTrips.length})`} ariaLabel="Planned trips">
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
        </DisclosureSection>

        <section aria-label="Evaluation metrics" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="App on-time rate" value={formatRate(metrics.appOnTimeRate)} />
          <Metric label="Baseline on-time rate" value={formatRate(metrics.baselineOnTimeRate)} />
          <Metric label="App mean arrival error" value={formatError(metrics.appMeanArrivalErrorMinutes)} />
          <Metric label="Baseline mean arrival error" value={formatError(metrics.baselineMeanArrivalErrorMinutes)} />
        </section>

        <p className="mt-4 text-sm text-slate-500">Based on {metrics.liveTripCount} live trips. Positive arrival error means you arrived late.</p>

        <DisclosureSection title={`Completed trip logs (${entries.length})`} ariaLabel="Completed trip logs" className="mt-6">
          {entries.length === 0 ? (
            <p className="px-4 py-8 text-sm text-slate-600 sm:px-6">After a trip, tap “I arrived” to log it.</p>
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
        </DisclosureSection>
      </div>
    </main>
  );
}

function DisclosureSection({
  title,
  ariaLabel,
  className = "",
  children,
}: {
  title: string;
  ariaLabel: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section aria-label={ariaLabel} className={`overflow-hidden rounded-2xl bg-white ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-4 text-left font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 sm:px-6"
      >
        <h2>{title}</h2>
        <svg className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300 ease-in-out motion-reduce:transition-none ${open ? "rotate-180" : "rotate-0"}`} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        aria-hidden={!open}
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="min-h-0 overflow-hidden border-t border-slate-200">{children}</div>
      </div>
    </section>
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
