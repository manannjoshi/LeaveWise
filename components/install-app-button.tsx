"use client";

import { useInstallFlow } from "@/components/app-shell";

export default function InstallAppButton({ className = "" }: { className?: string }) {
  const { canInstall, installApp } = useInstallFlow();
  if (!canInstall) return null;

  return (
    <button type="button" onClick={() => void installApp()} className={`min-h-11 bg-emerald-900 px-5 py-3 text-sm font-semibold text-white ${className}`}>
      Install app
    </button>
  );
}
