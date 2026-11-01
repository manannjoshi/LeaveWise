"use client";

import { useEffect, useState } from "react";
import { useInstallFlow } from "@/components/app-shell";

type Device = "iphone" | "android" | "windows" | "mac" | "linux" | "other";

const deviceLabels: Record<Device, string> = {
  iphone: "iPhone or iPad",
  android: "Android device",
  windows: "Windows computer",
  mac: "Mac computer",
  linux: "Linux computer",
  other: "Other device",
};

function detectDevice(userAgent: string, platform: string): Device {
  if (/iPhone|iPad|iPod/i.test(userAgent) || (platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "iphone";
  if (/Android/i.test(userAgent)) return "android";
  if (/Win/i.test(platform) || /Windows/i.test(userAgent)) return "windows";
  if (/Mac/i.test(platform) || /Macintosh/i.test(userAgent)) return "mac";
  if (/Linux/i.test(platform) || /Linux/i.test(userAgent)) return "linux";
  return "other";
}

function detectBrowser(userAgent: string) {
  if (/Edg/i.test(userAgent)) return "Microsoft Edge";
  if (/OPR|Opera/i.test(userAgent)) return "Opera";
  if (/FxiOS|Firefox/i.test(userAgent)) return "Firefox";
  if (/CriOS|Chrome/i.test(userAgent)) return "Google Chrome";
  if (/Safari/i.test(userAgent)) return "Safari";
  return "your browser";
}

function installSteps(device: Device, browser: string) {
  if (device === "iphone") {
    return [
      browser === "Safari" ? "Tap the Share button." : "Open this page in Safari, then tap Share.",
      "Scroll down and tap Add to Home Screen.",
      "Tap Add to finish.",
    ];
  }
  if (device === "android") {
    return [
      "Open the browser menu using the three dots.",
      "Tap Install app or Add to Home screen.",
      "Confirm the install.",
    ];
  }
  if (device === "windows" || device === "mac" || device === "linux") {
    return [
      "Open the browser menu.",
      "Choose Install LeaveWise or Install page as app. You may also see an install icon beside the address bar.",
      "Confirm the install.",
    ];
  }
  return [
    "Open LeaveWise in Safari on iPhone, or Chrome or Edge on another device.",
    "Open the browser menu and choose Install app or Add to Home screen.",
    "Confirm the install.",
  ];
}

export default function InstallPage() {
  const { canInstall, installApp, isInstalled } = useInstallFlow();
  const [detectedDevice, setDetectedDevice] = useState<Device | null>(null);
  const [browser, setBrowser] = useState("your browser");
  const [manualDevice, setManualDevice] = useState<Device | null>(null);
  const [showChoices, setShowChoices] = useState(false);

  useEffect(() => {
    const userAgent = navigator.userAgent;
    setDetectedDevice(detectDevice(userAgent, navigator.platform));
    setBrowser(detectBrowser(userAgent));
  }, []);

  const device = manualDevice ?? detectedDevice;

  return (
    <main className="px-4 py-5">
      <div className="mx-auto max-w-2xl">
        <h1 className="mt-3">Install LeaveWise</h1>

        <section className="settings-section mt-6 rounded-2xl bg-white p-4 sm:p-5" aria-live="polite">
          <h2 className="text-lg font-semibold">Your device</h2>
          {device ? (
            <p className="mt-2 text-sm text-slate-600">
              {manualDevice ? "Showing steps for " : "Detected "}
              <span className="font-semibold text-slate-900">{deviceLabels[device]}</span>
              {!manualDevice && ` using ${browser}`}.
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Checking your device…</p>
          )}

          {isInstalled ? (
            <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-900">LeaveWise is already installed on this device.</p>
          ) : (
            <>
              {canInstall && (
                <button type="button" onClick={() => void installApp()} className="mt-5 min-h-11 w-full rounded-xl bg-emerald-900 px-5 py-3 text-sm font-semibold text-white">
                  Install LeaveWise
                </button>
              )}

              {device && (
                <>
                  <h3 className="mt-5 font-semibold">How to install</h3>
                  <ol className="mt-3 list-decimal space-y-2 pl-6 text-sm text-slate-600">
                    {installSteps(device, browser).map((step) => <li key={step}>{step}</li>)}
                  </ol>
                </>
              )}

              <button
                type="button"
                aria-expanded={showChoices}
                onClick={() => setShowChoices((current) => !current)}
                className="mt-5 min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold"
              >
                {showChoices ? "Hide device choices" : "Incorrect detection?"}
              </button>
              {showChoices && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Choose your device">
                  {(Object.keys(deviceLabels) as Device[]).map((choice) => (
                    <button
                      type="button"
                      key={choice}
                      aria-pressed={device === choice}
                      onClick={() => setManualDevice(choice)}
                      className={`min-h-11 rounded-xl border px-3 py-2 text-sm ${device === choice ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"}`}
                    >
                      {deviceLabels[choice]}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
