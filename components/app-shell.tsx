"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

const installDismissedUntilKey = "leavewise-install-dismissed-until";
const dismissDurationMs = 14 * 24 * 60 * 60 * 1000;
const themeStorageKey = "leavewise-theme";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type IosInstallGuide = {
  browser: string;
  steps: string[];
};

function getIosInstallGuide(userAgent: string): IosInstallGuide {
  // Check branded iOS browsers before Safari, since their user agents also include Safari.
  if (/CriOS/i.test(userAgent)) {
    return {
      browser: "Chrome on iPhone",
      steps: [
        "Tap Share beside the address bar.",
        "Tap Add to Home Screen. If you don't see it, scroll the share options or tap View More if it appears.",
        "Tap Add to finish.",
      ],
    };
  }
  if (/FxiOS/i.test(userAgent)) {
    return {
      browser: "Firefox on iPhone",
      steps: [
        "Tap the Share icon in the address bar.",
        "Tap Add to Home Screen. If you don't see it, scroll the share options or tap View More if it appears.",
        "Tap Add to finish.",
      ],
    };
  }
  if (/EdgiOS/i.test(userAgent)) {
    return { browser: "Edge on iPhone", steps: safariInstallSteps(true) };
  }
  if (/OPiOS/i.test(userAgent)) {
    return { browser: "Opera on iPhone", steps: safariInstallSteps(true) };
  }
  if (/Brave/i.test(userAgent)) {
    return { browser: "Brave on iPhone", steps: safariInstallSteps(true) };
  }
  if (/Safari/i.test(userAgent)) {
    return { browser: "Safari on iPhone", steps: safariInstallSteps(false) };
  }
  return { browser: "your iPhone browser", steps: safariInstallSteps(true) };
}

function safariInstallSteps(useSafariFallback: boolean) {
  const steps = [
    "In Safari, open LeaveWise. Tap the page menu beside the address bar, then tap Share. If you already see the Share icon, tap it.",
    "Scroll down the share sheet and tap Add to Home Screen. On some screens, tap View More first. If the option is missing, scroll to the bottom and add it from Edit Actions.",
    "Tap Add to finish.",
  ];
  return useSafariFallback
    ? ["Open this page in Safari, then follow these steps:", ...steps]
    : steps;
}

type InstallContextValue = {
  isInstalled: boolean;
  isIosBrowserNotInstalled: boolean;
  iosInstallGuide: IosInstallGuide | null;
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
  const [isIosBrowserNotInstalled, setIsIosBrowserNotInstalled] = useState(false);
  const [iosInstallGuide, setIosInstallGuide] = useState<IosInstallGuide | null>(null);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const appleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const iosInstallGuide = appleMobile ? getIosInstallGuide(navigator.userAgent) : null;
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
    setIsIosBrowserNotInstalled(appleMobile && !checkInstalled());
    setIosInstallGuide(iosInstallGuide);
    setInstallDismissed(readDismissed());

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      if (androidChrome && !checkInstalled() && !readDismissed()) {
        setInstallPrompt(event as InstallPromptEvent);
      }
    }
    function onAppInstalled() {
      setIsInstalled(true);
      setIsIosBrowserNotInstalled(false);
      setIosInstallGuide(null);
      setInstallPrompt(null);
      setShowIosHelp(false);
    }
    function onDisplayModeChange() {
      const installed = checkInstalled();
      setIsInstalled(installed);
      if (installed) {
        setIsIosBrowserNotInstalled(false);
        setIosInstallGuide(null);
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

  useEffect(() => {
    let savedTheme: "dark" | "light" = "dark";
    try {
      savedTheme = localStorage.getItem(themeStorageKey) === "light" ? "light" : "dark";
    } catch {
      // The toggle still works for this session when storage is unavailable.
    }
    setTheme(savedTheme);
    document.documentElement.dataset.theme = savedTheme;
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    try {
      localStorage.setItem(themeStorageKey, nextTheme);
    } catch {
      // The selected theme remains active until the page is closed.
    }
  }
  // Treat the reduced visual viewport as an open mobile keyboard.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateKeyboardLayout = () => {
      const focusedField = document.activeElement instanceof HTMLElement &&
        document.activeElement.matches("input, textarea, select, [contenteditable='true']");
      const keyboardOpen = focusedField && window.innerHeight - viewport.height > 150;
      document.documentElement.classList.toggle("keyboard-open", Boolean(keyboardOpen));
    };
    const keepFocusedFieldVisible = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.matches("input, textarea, select, [contenteditable='true']")) {
        window.requestAnimationFrame(() => target.scrollIntoView({ block: "center", behavior: "auto" }));
      }
      updateKeyboardLayout();
    };
    const clearKeyboardLayout = () => document.documentElement.classList.remove("keyboard-open");

    viewport.addEventListener("resize", updateKeyboardLayout);
    window.addEventListener("resize", updateKeyboardLayout);
    document.addEventListener("focusin", keepFocusedFieldVisible);
    document.addEventListener("focusout", updateKeyboardLayout);
    window.addEventListener("blur", clearKeyboardLayout);
    return () => {
      viewport.removeEventListener("resize", updateKeyboardLayout);
      window.removeEventListener("resize", updateKeyboardLayout);
      document.removeEventListener("focusin", keepFocusedFieldVisible);
      document.removeEventListener("focusout", updateKeyboardLayout);
      window.removeEventListener("blur", clearKeyboardLayout);
      clearKeyboardLayout();
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
    if (isInstalled || !isIosBrowserNotInstalled || installDismissed) return false;
    setShowIosHelp(true);
    return true;
  }

  const installContext: InstallContextValue = {
    isInstalled,
    isIosBrowserNotInstalled: isIosBrowserNotInstalled && !isInstalled,
    iosInstallGuide,
    canInstall: Boolean(installPrompt) && !isInstalled && !installDismissed,
    installApp,
    showIosReminderHelp,
  };

  return (
    <div className="app-shell">
      <InstallContext.Provider value={installContext}>
        <div className="app-content">
          <div className="site-header">
            <div className="site-wordmark" aria-label="LeaveWise"><span>Leave</span><span className="site-wordmark-accent">Wise</span></div>
            <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
              {theme === "dark" ? (
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" /></svg>
              )}
            </button>
          </div>
          {pathname !== "/" && (
            <button type="button" className="back-button" onClick={() => router.push("/")} aria-label="Back to plan">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6M9 12h11" /></svg>
              <span>Back</span>
            </button>
          )}
          {children}
        </div>

        {showIosHelp && isIosBrowserNotInstalled && !isInstalled && !installDismissed && iosInstallGuide && (
          <div className="place-sheet-backdrop" onClick={rememberDismissal}>
            <section className="place-sheet install-sheet" role="dialog" aria-modal="true" aria-labelledby="ios-install-title" onClick={(event) => event.stopPropagation()}>
              <div className="place-sheet-handle" />
              <h2 id="ios-install-title" className="text-lg font-semibold">Install LeaveWise from {iosInstallGuide.browser}</h2>
              <p className="mt-3 text-slate-500">To get reminders on iPhone:</p>
              <ol className="mt-3 list-decimal space-y-2 pl-6 text-slate-500">
                {iosInstallGuide.steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
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
