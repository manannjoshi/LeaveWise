import TripForm from "@/components/trip-form";

export default function HomePage() {
  return (
    <main className="px-4 py-5">
      <div className="mx-auto max-w-2xl">
        <h1 className="mt-3">When should you leave?</h1>
        <p className="mt-2 max-w-xl text-slate-600">Plan a trip and arrive with time to spare.</p>
        <TripForm />
        <p className="mt-5 text-sm leading-5 text-slate-500">Travel estimates can change with traffic and conditions. Check your route before leaving.</p>
        <p className="mt-2 text-xs text-slate-500">
          Weather data by <a className="underline underline-offset-2" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> (CC BY 4.0); rain values are used to add a small departure buffer.
        </p>
      </div>
    </main>
  );
}
