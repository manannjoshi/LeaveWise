"use client";

import { useEffect, useState } from "react";
import type { TripRequest } from "@/lib/trip";
import { useInstallFlow } from "@/components/app-shell";

function decodeVapidKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export default function SaveTripButton({ trip, historyResiduals }: { trip: TripRequest; historyResiduals: number[] }) {
  const { isIosSafariNotInstalled, showIosReminderHelp } = useInstallFlow();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    fetch("/api/push/vapid-public-key")
      .then((response) => response.json())
      .then((data) => setPublicKey(data.publicKey ?? ""))
      .catch(() => setPublicKey(""));
  }, []);

  async function saveTrip() {
    setMessage("");
    setIsError(false);

    if (isIosSafariNotInstalled) {
      if (!showIosReminderHelp()) {
        setMessage("To enable iPhone reminders, add LeaveWise to your Home Screen from Safari.");
      }
      return;
    }

    if (!publicKey) {
      setIsError(true);
      setMessage("Push reminders need VAPID keys on the server first.");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setIsError(true);
      setMessage("This browser does not support web push notifications.");
      return;
    }

    setBusy(true);
    try {
      // Permission is requested only after the user presses this button.
      const permission = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Allow notifications to save this trip with reminders.");

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription() ??
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(publicKey) as BufferSource,
        });

      const response = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip,
          subscription: subscription.toJSON(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          historyResiduals,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save this trip.");
      setSaved(true);
      setMessage(data.message);
    } catch (reason) {
      setIsError(true);
      setMessage(reason instanceof Error ? reason.message : "Could not save this trip.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={saveTrip}
        disabled={busy || saved}
        className="w-full rounded-xl border border-emerald-200 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-60"
      >
        {busy ? "Saving trip and setting reminders…" : saved ? "Reminders enabled" : "Remind me"}
      </button>
      {message && <p className={`mt-3 text-sm ${isError ? "text-rose-200" : "text-emerald-100"}`} role={isError ? "alert" : "status"}>{message}</p>}
    </div>
  );
}
