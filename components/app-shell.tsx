"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

const installDismissedUntilKey = "leavewise-install-dismissed-until";
const dismissDurationMs = 14 * 24 * 60 * 60 * 1000;

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallContextValue = {
  isInstalled: boolean;
  isIosSafariNotInstalled: boolean;
  canInstall: boolean;
  installApp: () => Promise<void>;
  showIosReminderHelp: () => boolean;
};

const InstallContext = createContext<InstallContextValue | null>(null);

export function useInstallFlow() {
  const context = useContext(InstallContext);
  if (!context) throw new Error("useInstallFlow must be used inside AppShell.");
  return context;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIosSafariNotInstalled, setIsIosSafariNotInstalled] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const appleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const safari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);
    const androidChrome = /Android/.test(navigator.userAgent) && /Chrome/.test(navigator.userAgent) && !/EdgA|OPR/.test(navigator.userAgent);
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const checkInstalled = () => displayMode.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const readDismissed = () => {
      try {
        const until = Number(localStorage.getItem(installDismissedUntilKey) ?? 0);
        if (until > Date.now()) return true;
        if (until) localStorage.removeItem(installDismissedUntilKey);
      } catch {
        // Install prompts remain usable when local storage is unavailable.
      }
      return false;
    };

    setIsInstalled(checkInstalled());
    setIsIosSafariNotInstalled(appleMobile && safari && !checkInstalled());
    setInstallDismissed(readDismissed());

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      if (androidChrome && !checkInstalled() && !readDismissed()) {
        setInstallPrompt(event as InstallPromptEvent);
      }
    }
    function onAppInstalled() {
      setIsInstalled(true);
      setIsIosSafariNotInstalled(false);
      setInstallPrompt(null);
      setShowIosHelp(false);
    }
    function onDisplayModeChange() {
      const installed = checkInstalled();
      setIsInstalled(installed);
      if (installed) {
        setIsIosSafariNotInstalled(false);
        setInstallPrompt(null);
        setShowIosHelp(false);
      }
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    displayMode.addEventListener("change", onDisplayModeChange);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      displayMode.removeEventListener("change", onDisplayModeChange);
    };
  }, []);

  function rememberDismissal() {
    try {
      localStorage.setItem(installDismissedUntilKey, String(Date.now() + dismissDurationMs));
    } catch {
      // The current session still respects the dismissal if storage is blocked.
    }
    setInstallDismissed(true);
    setInstallPrompt(null);
  }

  async function installApp() {
    if (!installPrompt || isInstalled || installDismissed) return;
    const promptEvent = installPrompt;
    setInstallPrompt(null);
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "dismissed") {
      rememberDismissal();
    } else {
      setIsInstalled(true);
    }
  }

  function showIosReminderHelp() {
    if (isInstalled || !isIosSafariNotInstalled || installDismissed) return false;
    setShowIosHelp(true);
    return true;
  }

  const installContext: InstallContextValue = {
    isInstalled,
    isIosSafariNotInstalled: isIosSafariNotInstalled && !isInstalled,
    canInstall: Boolean(installPrompt) && !isInstalled && !installDismissed,
    installApp,
    showIosReminderHelp,
  };

  return (
    <div className="app-shell">
      <InstallContext.Provider value={installContext}>
        <div className="app-content">
          {pathname !== "/" && (
            <button type="button" className="back-button" onClick={() => router.push("/")} aria-label="Back to plan">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6M9 12h11" /></svg>
              <span>Back</span>
            </button>
          )}
          {children}
        </div>

        {showIosHelp && isIosSafariNotInstalled && !isInstalled && !installDismissed && (
          <div className="place-sheet-backdrop" onClick={rememberDismissal}>
            <section className="place-sheet install-sheet" role="dialog" aria-modal="true" aria-labelledby="ios-install-title" onClick={(event) => event.stopPropagation()}>
              <div className="place-sheet-handle" />
              <h2 id="ios-install-title" className="text-lg font-semibold">Install LeaveWise</h2>
              <p className="mt-3 text-slate-500">To get reminders on iPhone, tap Share, then Add to Home Screen.</p>
              <button type="button" className="mt-5 min-h-11 w-full bg-emerald-900 px-5 py-3 text-sm font-semibold text-white" onClick={rememberDismissal}>Got it</button>
            </section>
          </div>
        )}

        <nav className="bottom-tabs" aria-label="Main navigation">
          <Tab href="/" active={pathname === "/"} label="Plan" icon="plan" />
          <Tab href="/evaluation" active={pathname === "/evaluation"} label="Trips" icon="trips" />
          <Tab href="/settings" active={pathname === "/settings"} label="Settings" icon="settings" />
        </nav>
      </InstallContext.Provider>
    </div>
  );
}

function Tab({ href, active, label, icon }: { href: string; active: boolean; label: string; icon: "plan" | "trips" | "settings" }) {
  return (
    <Link href={href} className={`tab-link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {icon === "plan" && <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v10h13V10M9 20v-6h6v6" /></>}
        {icon === "trips" && <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>}
        {icon === "settings" && <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.1 1.9-2 3.4-2.2-.7a8 8 0 0 1-2 .9L14 23h-4l-.4-2.4a8 8 0 0 1-2-.9l-2.2.7-2-3.4 1.2-1.9a8 8 0 0 1 0-2.2l-1.2-1.9 2-3.4 2.2.7a8 8 0 0 1 2-.9L10 5h4l.4 2.4a8 8 0 0 1 2 .9l2.2-.7 2 3.4-1.2 1.9a8 8 0 0 1 0 2.1Z" transform="translate(-1 -2) scale(1.08)" /></>}
      </svg>
      <span>{label}</span>
    </Link>
  );
}
