import TripForm from "@/components/trip-form";

export default function HomePage() {
  return (
    <main className="px-4 py-5">
      <div className="mx-auto max-w-2xl">
        <h1 className="mt-3">When should you leave?</h1>
        <TripForm />
      </div>
    </main>
  );
}
