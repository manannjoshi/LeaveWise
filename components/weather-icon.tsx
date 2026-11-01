import type { WeatherIconKind } from "@/lib/trip";

export default function WeatherIcon({ kind, className = "" }: { kind: WeatherIconKind; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === "sun" && <>
        <circle cx="24" cy="24" r="8" />
        <path d="M24 4v5m0 30v5M4 24h5m30 0h5M9.9 9.9l3.6 3.6m21 21 3.6 3.6m0-28.2-3.6 3.6m-21 21-3.6 3.6" />
      </>}
      {kind === "moon" && <path d="M36.8 29.7A15.5 15.5 0 0 1 18.3 11.2 16 16 0 1 0 36.8 29.7Z" />}
      {kind === "partly-cloudy" && <>
        <circle cx="18" cy="17" r="6" />
        <path d="M18 6v3m0 16v2M7 17h3m16 0h2m-18-8 2.2 2.2m11.6 11.6L26 25m0-16-2.2 2.2M12.2 22.8 10 25" />
        <path d="M14 36h20a7 7 0 0 0 .3-14A11 11 0 0 0 13 25a5.5 5.5 0 0 0 1 11Z" />
      </>}
      {(kind === "cloudy" || kind === "fog" || kind === "drizzle" || kind === "rain" || kind === "snow" || kind === "storm") && <>
        <path d="M11 29h24a7 7 0 0 0 .3-14 11 11 0 0 0-21.4 3A5.5 5.5 0 0 0 11 29Z" />
        {kind === "fog" && <path d="M10 35h26m-22 5h20" />}
        {kind === "drizzle" && <path d="m18 34-2 4m10-4-2 4m10-4-2 4" />}
        {kind === "rain" && <path d="m17 34-3 6m12-6-3 6m12-6-3 6" />}
        {kind === "snow" && <>
          <path d="M17 34v8m-3-2 6-4m-6 0 6 4m8-6v8m-3-2 6-4m-6 0 6 4" />
        </>}
        {kind === "storm" && <path d="m27 32-6 8h5l-2 6 8-10h-5l3-4" />}
      </>}
    </svg>
  );
}
