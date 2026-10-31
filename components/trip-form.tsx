"use client";

import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Importance, LeavePlan, Place, TravelMode, TripRequest } from "@/lib/trip";
import { arrivalInMinutes, arriveByValidationError, toLocalDateTimeInputValue, tomorrowAtNineLocal } from "@/lib/date-time";
import { addTripHistoryEntry, clearActiveTrip, getCalibrationResiduals, makeTripHistoryEntry, readActiveTrip, readTripHistory, saveActiveTrip } from "@/lib/trip-history";
import type { ActiveTrip, TripHistoryEntry } from "@/lib/trip-history";
import SaveTripButton from "@/components/save-trip-button";
import InstallAppButton from "@/components/install-app-button";

type PlaceFieldProps = {
  title: string;
  value: string;
  selected: Place | null;
  onValueChange: (value: string) => void;
  onSelect: (place: Place) => void;
  onSourceChange: (source: "tomtom" | "mock") => void;
  action?: ReactNode;
};

function PlaceField({ title, value, selected, onValueChange, onSelect, onSourceChange, action }: PlaceFieldProps) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (selected || value.trim().length < 2) {
      setPlaces([]);
      return;
    }
    // Wait until the user pauses typing, then ask our server route for suggestions.
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/places?q=${encodeURIComponent(value)}`);
        const data = await response.json();
        setPlaces(data.places ?? []);
        setSheetOpen(Boolean(data.places?.length));
        onSourceChange(data.source === "tomtom" ? "tomtom" : "mock");
      } catch {
        setPlaces([]);
        setSheetOpen(false);
        onSourceChange("mock");
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [value, selected, onSourceChange]);

  return (
    <div className="relative form-row min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="block text-sm font-semibold" htmlFor={title}>{title}</label>
        {action}
      </div>
      <input
        id={title}
        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onFocus={() => { if (places.length) setSheetOpen(true); }}
        placeholder={`Search ${title.toLowerCase()}`}
        autoComplete="off"
        required
      />
      {places.length > 0 && sheetOpen && (
        <div className="place-sheet-backdrop" onClick={() => setSheetOpen(false)}>
          <section className="place-sheet" role="dialog" aria-modal="true" aria-label={`Choose ${title.toLowerCase()}`} onClick={(event) => event.stopPropagation()}>
            <div className="place-sheet-handle" />
            <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Choose {title.toLowerCase()}</h2>
              <button type="button" onClick={() => setSheetOpen(false)} className="min-h-11 rounded-full px-3 text-accent">Close</button>
            </div>
            <ul role="listbox">
              {places.map((place, index) => (
                <li className="place-sheet-row" key={`${place.label}-${index}`}>
                  <button type="button" role="option" aria-selected="false" onClick={() => { onSelect(place); setPlaces([]); setSheetOpen(false); }}>
                    {place.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
      {selected?.label.toLowerCase().endsWith("(sample location)") ? (
        <p role="status" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          Using sample locations: add a TomTom key
        </p>
      ) : selected?.label === "My current location" ? (
        <p className="mt-1 text-xs text-emerald-800">Using this device&apos;s location</p>
      ) : selected ? (
        <p className="mt-1 text-xs text-emerald-800">Place selected</p>
      ) : null}
    </div>
  );
}

function prettyTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function TripForm() {
  const [originText, setOriginText] = useState("");
  const [destinationText, setDestinationText] = useState("");
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [arriveBy, setArriveBy] = useState(() => tomorrowAtNineLocal());
  const [arriveByError, setArriveByError] = useState("");
  const [mode, setMode] = useState<TravelMode>("car");
  const [importance, setImportance] = useState<Importance>("important");
  const [buffer, setBuffer] = useState(8);
  const [plan, setPlan] = useState<LeavePlan | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [naturalText, setNaturalText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseMessage, setParseMessage] = useState("");
  const [parseError, setParseError] = useState("");
  const [needsOriginConfirmation, setNeedsOriginConfirmation] = useState(false);
  const [geocodingSource, setGeocodingSource] = useState<"tomtom" | "mock" | null>(null);
  const [arrivalLogMessage, setArrivalLogMessage] = useState("");
  const [arrivalLogError, setArrivalLogError] = useState("");
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [recentRoutes, setRecentRoutes] = useState<TripHistoryEntry[]>([]);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [clock, setClock] = useState(Date.now());

  useEffect(() => {
    const savedTrip = readActiveTrip();
    if (savedTrip) {
      setActiveTrip(savedTrip);
      setOrigin(savedTrip.trip.origin);
      setOriginText(savedTrip.trip.origin.label);
      setDestination(savedTrip.trip.destination);
      setDestinationText(savedTrip.trip.destination.label);
      setArriveBy(toLocalDateTimeInputValue(new Date(savedTrip.trip.arriveBy)));
      setMode(savedTrip.trip.mode);
      setImportance(savedTrip.trip.importance);
      setBuffer(savedTrip.trip.fixedBufferMinutes ?? 0);
      setPlan(savedTrip.plan);
    }

    const usedRoutes = new Set<string>();
    const routes = readTripHistory().filter((entry) => entry.routingSource === "tomtom").reverse().filter((entry) => {
      const key = `${entry.originLat},${entry.originLon}:${entry.destinationLat},${entry.destinationLon}`;
      if (usedRoutes.has(key)) return false;
      usedRoutes.add(key);
      return true;
    }).slice(0, 4);
    setRecentRoutes(routes);
  }, []);

  useEffect(() => {
    if (!activeTrip) return;
    const timer = window.setInterval(() => setClock(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [activeTrip]);

  function changeMode(nextMode: TravelMode) {
    setMode(nextMode);
    setBuffer(nextMode === "car" ? 8 : nextMode === "two-wheeler" ? 5 : 0);
  }

  async function fillFromDescription() {
    setParseError("");
    setParseMessage("");
    const text = naturalText.trim();
    if (text.length < 8) {
      setParseError("Add a little more detail, like where you’re going and when you need to arrive.");
      return;
    }

    setParsing(true);
    try {
      const response = await fetch("/api/parse-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not read that trip. Fill in the form below.");
      if (!data.trip || typeof data.trip.destination !== "string" || !data.trip.arriveBy) {
        throw new Error("Could not find both places and an arrival time. Fill in the form below.");
      }

      setOrigin(null);
      setOriginText(typeof data.trip.origin === "string" ? data.trip.origin : "");
      setDestinationText(data.trip.destination);
      setDestination(null);
      setArriveBy(toLocalDateTimeInputValue(new Date(data.trip.arriveBy)));
      setArriveByError("");
      changeMode(data.trip.mode);
      setImportance(data.trip.importance);
      setPlan(null);
      setError("");
      setGeocodingSource(null);
      setNeedsOriginConfirmation(Boolean(data.needsOrigin));

      if (data.needsOrigin) {
        // Resolve the destination from TomTom so the user can continue with taps, not typing.
        try {
          const placeResponse = await fetch(`/api/places?q=${encodeURIComponent(data.trip.destination)}`);
          const placeData = await placeResponse.json();
          if (placeData.source === "tomtom" && placeData.places?.[0]) {
            setDestination(placeData.places[0]);
            setDestinationText(placeData.places[0].label);
            setGeocodingSource("tomtom");
          } else {
            setGeocodingSource("mock");
          }
        } catch {
          setGeocodingSource("mock");
        }
        setParseMessage("");
      } else {
        setParseMessage("Trip details filled in. Choose a place suggestion for each location, then review the time.");
      }
    } catch (reason) {
      setParseError(reason instanceof Error ? reason.message : "Could not read that trip. Fill in the form below.");
    } finally {
      setParsing(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPlan(null);
    setArrivalLogMessage("");
    setArrivalLogError("");
    const timeError = arriveByValidationError(arriveBy);
    setArriveByError(timeError);
    if (timeError) return;
    if (!origin || !destination) {
      setError("Choose a suggestion for both places so we know their coordinates.");
      return;
    }
    setLoading(true);
    try {
      const body: TripRequest = {
        origin,
        destination,
        arriveBy: new Date(arriveBy).toISOString(),
        mode,
        importance,
        fixedBufferMinutes: buffer,
      };
      const historyResiduals = getCalibrationResiduals(readTripHistory());
      const response = await fetch("/api/leave-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, historyResiduals }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not plan this trip.");
      setPlan(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not plan this trip.");
    } finally {
      setLoading(false);
    }
  }

  function recordArrival() {
    setArrivalLogError("");
    if (!activeTrip) return;
    const elapsedMinutes = Math.max(0.1, Math.round((Date.now() - Date.parse(activeTrip.startedAt)) / 6_000) / 10);
    const saved = addTripHistoryEntry(makeTripHistoryEntry({
      trip: activeTrip.trip,
      plan: activeTrip.plan,
      actualDurationMinutes: elapsedMinutes,
    }));
    if (!saved) {
      setArrivalLogError("Could not save this trip log in this browser.");
      return;
    }
    clearActiveTrip();
    setActiveTrip(null);
    setArrivalLogMessage(`Logged ${elapsedMinutes.toFixed(1)} min actual vs ${activeTrip.plan.durationMinutes} min predicted.`);
    const usedRoutes = new Set<string>();
    setRecentRoutes(readTripHistory().filter((entry) => entry.routingSource === "tomtom").reverse().filter((entry) => {
      const key = `${entry.originLat},${entry.originLon}:${entry.destinationLat},${entry.destinationLon}`;
      if (usedRoutes.has(key)) return false;
      usedRoutes.add(key);
      return true;
    }).slice(0, 4));
  }

  function startTripTimer() {
    if (!plan || !origin || !destination) return;
    setArrivalLogError("");
    const snapshot: ActiveTrip = {
      trip: {
        origin,
        destination,
        arriveBy: new Date(arriveBy).toISOString(),
        mode,
        importance,
        fixedBufferMinutes: buffer,
      },
      plan,
      startedAt: new Date().toISOString(),
    };
    if (!saveActiveTrip(snapshot)) {
      setArrivalLogError("Could not start the timer in this browser.");
      return;
    }
    setActiveTrip(snapshot);
    setClock(Date.now());
  }

  function useCurrentLocation() {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Location is not available in this browser.");
      return;
    }
    setLocationBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const place = { label: "My current location", lat: position.coords.latitude, lon: position.coords.longitude };
        setOrigin(place);
        setOriginText(place.label);
        setPlan(null);
        setGeocodingSource(null);
        if (needsOriginConfirmation) {
          setNeedsOriginConfirmation(false);
          setParseMessage("Location added as your starting point. Check the trip details, then tap When should I leave?");
        }
        setLocationBusy(false);
      },
      (reason) => {
        setLocationError(reason.code === 1
          ? "Allow location access, or type your starting place."
          : "Could not get your location. Try again or type your starting place.");
        setLocationBusy(false);
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
    );
  }

  function repeatRoute(entry: TripHistoryEntry) {
    setOrigin({ label: entry.origin, lat: entry.originLat, lon: entry.originLon });
    setOriginText(entry.origin);
    setDestination({ label: entry.destination, lat: entry.destinationLat, lon: entry.destinationLon });
    setDestinationText(entry.destination);
    setPlan(null);
  }

  function chooseArrivalTime(value: string) {
    setArriveBy(value);
    setArriveByError("");
    setPlan(null);
  }

  const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none";

  return (
    <>
      {process.env.NODE_ENV === "development" && (
        <section aria-label="Development service status" className="mt-6 rounded-xl bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-600">Service status</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <ServiceStatus label="Routing" status={plan ? (plan.source === "tomtom" ? "Live" : "Mocked") : "Not checked"} />
            <ServiceStatus label="Geocoding" status={geocodingSource ? (geocodingSource === "tomtom" ? "Live" : "Mocked") : "Not checked"} />
            <ServiceStatus label="Weather" status={plan ? (plan.weatherStatus === "unavailable" ? "Unavailable" : "Live") : "Not checked"} />
          </div>
        </section>
      )}
      <div className="planner-columns">
      <form onSubmit={submit} className="planner-form mt-6 min-w-0 rounded-2xl bg-white p-4 sm:p-5">
        <fieldset disabled={Boolean(activeTrip)} className="space-y-5 disabled:opacity-70">
        <section className="rounded-2xl bg-emerald-50/70 p-4 sm:p-5" aria-labelledby="quick-trip-title">
          <label id="quick-trip-title" className="block text-base font-bold text-emerald-950" htmlFor="naturalTrip">Describe your trip</label>
          <p className="mt-1 text-sm text-emerald-900">For example: “Be at the airport by 6am Friday from my hostel.”</p>
          <textarea
            id="naturalTrip"
            className={`${inputClass} mt-3 min-h-24 resize-y border-emerald-200 bg-white`}
            value={naturalText}
            maxLength={500}
            placeholder="Where are you going, and when do you need to arrive?"
            onChange={(event) => { setNaturalText(event.target.value); setParseError(""); setParseMessage(""); }}
          />
          <button
            type="button"
            onClick={fillFromDescription}
            disabled={parsing || naturalText.trim().length < 8}
            className="mt-3 min-h-11 w-full rounded-xl border border-emerald-900 bg-white px-4 py-2.5 text-sm font-bold text-emerald-950 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {parsing ? "Reading your trip…" : "Fill trip details"}
          </button>
          <p className="mt-2 text-sm text-emerald-900/80">Your sentence and timezone go to Groq to fill the form. Review the trip before planning.</p>
          {parseMessage && <p role="status" className="mt-2 text-sm font-medium text-emerald-900">{parseMessage}</p>}
          {parseError && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{parseError}</p>}
          {needsOriginConfirmation && (
            <div className="mt-3 rounded-xl bg-amber-50 p-3" role="status">
              <p className="text-sm font-semibold text-amber-950">I couldn&apos;t find a starting point. Would you like to use your current location?</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={useCurrentLocation} disabled={locationBusy} className="min-h-11 rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {locationBusy ? "Finding location…" : "Use my location"}
                </button>
                <button type="button" onClick={() => { setNeedsOriginConfirmation(false); document.getElementById("Origin")?.focus(); }} className="min-h-11 rounded-lg border border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-950">
                  I&apos;ll enter it
                </button>
              </div>
            </div>
          )}
        </section>

        <div className="flex items-center gap-3 pt-1" aria-hidden="true">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-sm font-semibold text-slate-500">Or fill it in</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        {recentRoutes.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold">Repeat a recent trip</p>
            <div className="recent-routes flex flex-wrap gap-2 pb-1">
              {recentRoutes.map((route) => (
                <button key={`${route.id}-repeat`} type="button" onClick={() => repeatRoute(route)} className="recent-route min-h-11 max-w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-950">
                  <span className="place-name">{route.origin}</span><span aria-hidden="true"> → </span><span className="place-name">{route.destination}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <PlaceField
          title="Origin"
          value={originText}
          selected={origin}
          onValueChange={(value) => { setOriginText(value); setOrigin(null); setPlan(null); setGeocodingSource(null); }}
          onSelect={(place) => { setOrigin(place); setOriginText(place.label); setPlan(null); }}
          onSourceChange={setGeocodingSource}
          action={<button type="button" onClick={useCurrentLocation} disabled={locationBusy} className="min-h-11 rounded-full bg-emerald-50 px-3 text-sm font-semibold text-emerald-900 disabled:opacity-60">{locationBusy ? "Finding location…" : "Use my location"}</button>}
        />
        {locationError && <p role="alert" className="-mt-3 text-xs text-red-700">{locationError}</p>}
        <PlaceField title="Destination" value={destinationText} selected={destination} onValueChange={(value) => { setDestinationText(value); setDestination(null); setPlan(null); setGeocodingSource(null); }} onSelect={(place) => { setDestination(place); setDestinationText(place.label); setPlan(null); }} onSourceChange={setGeocodingSource} />

        <div className="form-row">
          <label className="mb-2 block text-sm font-semibold" htmlFor="arriveBy">Arrive by</label>
          <div className="mb-3 flex flex-wrap gap-2" aria-label="Quick arrival times">
            {[
              { label: "In 30 min", minutes: 30 },
              { label: "In 1 hour", minutes: 60 },
              { label: "In 2 hours", minutes: 120 },
              { label: "Tomorrow 9 AM", minutes: null },
            ].map((choice) => (
              <button
                key={choice.label}
                type="button"
                onClick={() => chooseArrivalTime(choice.minutes === null ? tomorrowAtNineLocal() : arrivalInMinutes(choice.minutes))}
                className="min-h-11 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
              >
                {choice.label}
              </button>
            ))}
          </div>
          <input
            id="arriveBy"
            className={inputClass}
            type="datetime-local"
            value={arriveBy}
            min={toLocalDateTimeInputValue(new Date())}
            aria-invalid={Boolean(arriveByError)}
            aria-describedby={arriveByError ? "arriveByError" : undefined}
            onChange={(event) => {
              setArriveBy(event.target.value);
              setArriveByError(event.target.value ? arriveByValidationError(event.target.value) : "");
              setPlan(null);
            }}
            required
          />
          {arriveByError && <p id="arriveByError" role="alert" className="mt-2 text-sm font-medium text-red-700">{arriveByError}</p>}
        </div>

        <div className="form-row">
          <p id="modeLabel" className="mb-2 text-sm font-semibold">Travel mode</p>
          <div role="group" aria-labelledby="modeLabel" className="grid grid-cols-3 gap-2">
            <ChoiceButton label="Car" selected={mode === "car"} onClick={() => { changeMode("car"); setPlan(null); }} />
            <ChoiceButton label="Two-wheeler" selected={mode === "two-wheeler"} onClick={() => { changeMode("two-wheeler"); setPlan(null); }} />
            <ChoiceButton label="Walk" selected={mode === "walk"} onClick={() => { changeMode("walk"); setPlan(null); }} />
          </div>
        </div>

        <div className="form-row">
          <p id="importanceLabel" className="mb-2 text-sm font-semibold">How bad is being late?</p>
          <div role="group" aria-labelledby="importanceLabel" className="grid grid-cols-3 gap-2">
            <ChoiceButton label="Casual" detail="80%" selected={importance === "casual"} onClick={() => { setImportance("casual"); setPlan(null); }} />
            <ChoiceButton label="Important" detail="95%" selected={importance === "important"} onClick={() => { setImportance("important"); setPlan(null); }} />
            <ChoiceButton label="Critical" detail="99%" selected={importance === "critical"} onClick={() => { setImportance("critical"); setPlan(null); }} />
          </div>
        </div>

        <details className="rounded-xl bg-slate-50 px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold">More options, fixed buffer {buffer} min</summary>
          <div className="mt-3">
            <label className="mb-2 block text-sm font-medium" htmlFor="buffer">Fixed buffer (minutes)</label>
            <input id="buffer" className={inputClass} type="number" min="0" max="180" value={buffer} onChange={(event) => { setBuffer(Number(event.target.value)); setPlan(null); }} required />
            <p className="mt-1 text-xs text-slate-500">Defaults: car 8, two-wheeler 5, walk 0 minutes.</p>
          </div>
        </details>

        {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
        </fieldset>
        <div className="primary-action-bar">
          <button disabled={loading || Boolean(activeTrip)} className="primary-action-button w-full rounded-xl bg-emerald-900 px-5 py-3 font-semibold text-white transition disabled:cursor-wait disabled:opacity-60">
            {loading ? "Planning your trip…" : "When should I leave?"}
          </button>
        </div>
      </form>

      {plan && (
        <section aria-live="polite" className="trip-result mt-5 rounded-2xl bg-emerald-950 p-5 text-white sm:p-6">
          <p className="text-sm font-medium text-emerald-200">Recommended leave time</p>
          <p className="leave-time-value">{prettyTime(plan.leaveAt)}</p>
          <p className="mt-3 text-emerald-100">Arrive by {prettyTime(plan.arriveBy)} | {plan.durationMinutes} min expected travel</p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={plan.safetyMarginMethod === "learned" ? `Safety margin, learned (${plan.safetyMarginSampleCount})` : "Safety margin"} value={`${plan.safetyMarginMinutes} min`} />
            <Stat label="Fixed buffer" value={`${plan.fixedBufferMinutes} min`} />
            <Stat label="On-time confidence" value={`${plan.confidence}%`} status={plan.confidence >= 99 ? "good" : plan.confidence >= 95 ? "tight" : "risky"} />
            <Stat
              label="Rain adjustment"
              value={mode === "car" ? "Not applied (car)" : plan.weatherPenaltyMinutes > 0 ? `+${plan.weatherPenaltyMinutes} min` : plan.weatherStatus === "unavailable" ? "Unknown" : "None"}
            />
          </div>
          <p className="mt-5 text-sm text-emerald-100">{plan.explanation}</p>
          {plan.source === "mock" && <p className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-xs text-emerald-100">Sample estimate: add a TomTom key for live traffic-aware routing.</p>}
          <section className="mt-5 rounded-xl bg-white/10 p-4">
            <h2 className="text-sm font-semibold">After your trip</h2>
            <p className="mt-1 text-sm text-emerald-100">Predicted {plan.durationMinutes} min. Start the timer when you leave, then tap once when you arrive.</p>
            {activeTrip ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-emerald-100">Timer running | {Math.max(0, Math.floor((clock - Date.parse(activeTrip.startedAt)) / 60_000))} min elapsed</p>
                <button type="button" onClick={recordArrival} className="rounded-lg bg-white px-5 py-3 text-sm font-bold text-emerald-950">I arrived</button>
              </div>
            ) : arrivalLogMessage ? (
              <p role="status" className="mt-2 text-sm text-emerald-100">{arrivalLogMessage}</p>
            ) : (
              <button type="button" onClick={startTripTimer} className="mt-3 w-full rounded-lg bg-white px-4 py-3 text-sm font-bold text-emerald-950">I left, start timer</button>
            )}
            {arrivalLogError && <p role="alert" className="mt-2 text-sm text-rose-200">{arrivalLogError}</p>}
          </section>
          {!activeTrip && <SaveTripButton historyResiduals={getCalibrationResiduals(readTripHistory())} trip={{
            origin: origin!,
            destination: destination!,
            arriveBy: new Date(arriveBy).toISOString(),
            mode,
            importance,
            fixedBufferMinutes: buffer,
          }} />}
          <InstallAppButton className="mt-3 w-full" />
        </section>
      )}
      </div>
    </>
  );
}

function ServiceStatus({ label, status }: { label: string; status: string }) {
  return (
    <p className="rounded-md bg-white px-2 py-1.5 text-slate-700">
      <span className="font-semibold">{label}:</span> {status}
    </p>
  );
}

function ChoiceButton({ label, detail, selected, onClick }: { label: string; detail?: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-14 rounded-xl border px-2 py-2 text-sm font-semibold transition ${selected ? "border-emerald-900 bg-emerald-900 text-white" : "border-slate-300 bg-white text-slate-800 hover:border-emerald-700"}`}
    >
      <span className="block">{label}</span>
      {detail && <span className={`mt-0.5 block text-xs ${selected ? "text-emerald-100" : "text-slate-500"}`}>{detail} target</span>}
    </button>
  );
}

function Stat({ label, value, status }: { label: string; value: string; status?: "good" | "tight" | "risky" }) {
  return <div className="rounded-xl bg-white/10 p-3"><p className="text-sm text-emerald-200">{label}</p><p className="mt-1 text-lg font-semibold">{status && <span className={`confidence-dot ${status}`} aria-hidden="true" />}{value}</p></div>;
}
