import TripForm from "@/components/trip-form";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">Leave On Time</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Arrive calm. Leave smart.</h1>
        <p className="mt-3 max-w-xl text-slate-600">Tell us where you’re going and when you need to be there. We’ll plan a little breathing room.</p>
        <Link href="/evaluation" className="mt-3 inline-block text-sm font-semibold text-emerald-800 underline underline-offset-4">View trip evaluation</Link>
        <TripForm />
        <p className="mt-5 text-xs leading-5 text-slate-500">Travel estimates can change with traffic and conditions. Check your route before leaving.</p>
        <p className="mt-2 text-xs text-slate-500">
          Weather data by <a className="underline underline-offset-2" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> (CC BY 4.0); rain values are used to add a small departure buffer.
        </p>
      </div>
    </main>
  );
}
