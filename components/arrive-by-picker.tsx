"use client";

import { useEffect, useState } from "react";
import { arriveByValidationError } from "@/lib/date-time";

type ArriveByPickerProps = {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
};

function readLocalDateTime(value: string) {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function toLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function makeLocalValue(date: Date, hour: number, minute: number, period: "AM" | "PM") {
  const hour24 = (hour % 12) + (period === "PM" ? 12 : 0);
  return toLocalValue(new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour24, minute));
}

function twelveHourTime(date: Date) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function calendarDays(month: Date) {
  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Math.ceil((firstWeekday + dayCount) / 7) * 7;
  return Array.from({ length: cells }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day > 0 && day <= dayCount
      ? new Date(month.getFullYear(), month.getMonth(), day)
      : null;
  });
}

function sameDay(first: Date, second: Date) {
  return first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate();
}

export default function ArriveByPicker({ value, onChange, invalid = false, describedBy }: ArriveByPickerProps) {
  const [mounted, setMounted] = useState(false);
  const [openMode, setOpenMode] = useState<"date" | "time" | null>(null);
  const [draftDate, setDraftDate] = useState(() => readLocalDateTime(value));
  const [month, setMonth] = useState(() => {
    const date = readLocalDateTime(value);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [period, setPeriod] = useState<"AM" | "PM">("AM");
  const [activeTimeChoice, setActiveTimeChoice] = useState<"hour" | "minute" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedDate = readLocalDateTime(value);
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(month);
  const days = calendarDays(month);
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(new Date(2024, 0, 7 + index))
  );

  function openPicker(mode: "date" | "time") {
    const current = readLocalDateTime(value);
    setDraftDate(current);
    setMonth(new Date(current.getFullYear(), current.getMonth(), 1));
    setHour(current.getHours() % 12 || 12);
    setMinute(current.getMinutes());
    setPeriod(current.getHours() >= 12 ? "PM" : "AM");
    setActiveTimeChoice(null);
    setError("");
    setOpenMode(mode);
  }

  function confirm() {
    const nextValue = makeLocalValue(draftDate, hour, minute, period);
    const validationError = arriveByValidationError(nextValue);
    if (validationError) {
      setError(validationError);
      return;
    }
    onChange(nextValue);
    setOpenMode(null);
  }

  function chooseDate(date: Date) {
    const nextValue = makeLocalValue(date, hour, minute, period);
    const validationError = arriveByValidationError(nextValue);
    if (validationError) {
      setDraftDate(date);
      setError(validationError);
      return;
    }
    onChange(nextValue);
    setOpenMode(null);
  }

  function changeHour(amount: number) {
    setHour((current) => ((current - 1 + amount + 12) % 12) + 1);
  }

  function changeMinute(amount: number) {
    setMinute((current) => (current + amount + 60) % 60);
  }

  return (
    <>
      <div className="arrival-picker-trigger">
        <button
          id="arriveBy"
          type="button"
          className="arrival-picker-date-button"
          aria-haspopup="dialog"
          aria-expanded={openMode === "date"}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onClick={() => openPicker("date")}
        >
          <span className="arrival-picker-caption">Date</span>
          <span className="arrival-picker-value">{mounted ? selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : "Tomorrow"}</span>
        </button>
        <button
          type="button"
          className="arrival-picker-time-trigger"
          aria-haspopup="dialog"
          aria-expanded={openMode === "time"}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onClick={() => openPicker("time")}
        >
          <span className="arrival-picker-caption">Time</span>
          <span className="arrival-picker-trigger-time">{mounted ? twelveHourTime(selectedDate) : "9:00 AM"}</span>
        </button>
      </div>

      {openMode && (
        <div className="place-sheet-backdrop" onClick={() => setOpenMode(null)}>
          <section
            className="place-sheet arrival-picker-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="arrival-picker-title"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => { if (event.key === "Escape") setOpenMode(null); }}
          >
            <div className="place-sheet-handle" />
            <div className="arrival-picker-heading">
              <div>
                <h2 id="arrival-picker-title" className="text-lg font-semibold">Choose arrival {openMode}</h2>
                <p className="mt-1 text-sm text-slate-500">{draftDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} at {hour}:{String(minute).padStart(2, "0")} {period}</p>
              </div>
              <button type="button" className="min-h-11 px-3 text-accent" onClick={() => setOpenMode(null)}>Close</button>
            </div>

            {openMode === "date" && <>
            <div className="arrival-month-row">
              <button type="button" className="arrival-month-button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
              <p aria-live="polite">{monthLabel}</p>
              <button type="button" className="arrival-month-button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
            </div>

            <div className="arrival-calendar-grid" role="group" aria-label={monthLabel}>
              {weekdays.map((weekday, index) => <span key={`weekday-${index}`} className="arrival-weekday" aria-hidden="true">{weekday}</span>)}
              {days.map((day, index) => {
                if (!day) return <span key={`empty-${index}`} aria-hidden="true" />;
                const isPastDay = new Date(day.getFullYear(), day.getMonth(), day.getDate()) < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    className={`arrival-day${sameDay(day, draftDate) ? " is-selected" : ""}`}
                    aria-label={day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                    aria-pressed={sameDay(day, draftDate)}
                    disabled={isPastDay}
                    onClick={() => chooseDate(day)}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
            </>}

            {openMode === "time" && <div className="arrival-time-section">
              <p className="arrival-section-label">Time</p>
              <div className="arrival-time-controls">
                <div className="arrival-time-column">
                  <span className="arrival-time-label">Hour</span>
                  <button type="button" className="arrival-step-button" aria-label="Earlier hour" onClick={() => changeHour(-1)}>−</button>
                  <button type="button" className="arrival-time-number" aria-label={`Choose hour, currently ${hour}`} aria-expanded={activeTimeChoice === "hour"} onClick={() => setActiveTimeChoice(activeTimeChoice === "hour" ? null : "hour")}>{hour}</button>
                  <button type="button" className="arrival-step-button" aria-label="Later hour" onClick={() => changeHour(1)}>+</button>
                </div>
                <div className="arrival-time-column">
                  <span className="arrival-time-label">Minute</span>
                  <button type="button" className="arrival-step-button" aria-label="Earlier by five minutes" onClick={() => changeMinute(-5)}>−</button>
                  <button type="button" className="arrival-time-number" aria-label={`Choose minutes, currently ${String(minute).padStart(2, "0")}`} aria-expanded={activeTimeChoice === "minute"} onClick={() => setActiveTimeChoice(activeTimeChoice === "minute" ? null : "minute")}>{String(minute).padStart(2, "0")}</button>
                  <button type="button" className="arrival-step-button" aria-label="Later by five minutes" onClick={() => changeMinute(5)}>+</button>
                </div>
                <div className="arrival-time-column">
                  <span className="arrival-time-label">Period</span>
                  <button type="button" className={`arrival-period-button${period === "AM" ? " is-selected" : ""}`} aria-pressed={period === "AM"} onClick={() => setPeriod("AM")}>AM</button>
                  <span className="arrival-time-spacer" aria-hidden="true" />
                  <button type="button" className={`arrival-period-button${period === "PM" ? " is-selected" : ""}`} aria-pressed={period === "PM"} onClick={() => setPeriod("PM")}>PM</button>
                </div>
              </div>
              {activeTimeChoice === "hour" && (
                <div className="arrival-time-choice-grid" role="group" aria-label="Choose hour">
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((choice) => (
                    <button key={choice} type="button" className={`arrival-time-choice${hour === choice ? " is-selected" : ""}`} aria-pressed={hour === choice} onClick={() => { setHour(choice); setActiveTimeChoice(null); }}>
                      {choice}
                    </button>
                  ))}
                </div>
              )}
              {activeTimeChoice === "minute" && (
                <div className="arrival-time-choice-grid" role="group" aria-label="Choose minutes">
                  {Array.from({ length: 12 }, (_, index) => index * 5).map((choice) => (
                    <button key={choice} type="button" className={`arrival-time-choice${minute === choice ? " is-selected" : ""}`} aria-pressed={minute === choice} onClick={() => { setMinute(choice); setActiveTimeChoice(null); }}>
                      {String(choice).padStart(2, "0")}
                    </button>
                  ))}
                </div>
              )}
            </div>}

            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
            <div className="arrival-picker-actions">
              <button type="button" className="arrival-cancel-button" onClick={() => setOpenMode(null)}>Cancel</button>
              {openMode === "time" && <button type="button" className="arrival-confirm-button" onClick={confirm}>Use this time</button>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
