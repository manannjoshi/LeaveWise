import InstallAppButton from "@/components/install-app-button";

export default function SettingsPage() {
  return (
    <main className="px-4 py-5">
      <h1 className="mt-3">Settings</h1>
      <p className="mt-2 text-slate-600">Trip preferences are chosen when you plan each trip.</p>

      <section className="mt-7 overflow-hidden rounded-2xl bg-white">
        <SettingRow title="Travel mode" detail="Choose car, two-wheeler, or walk in Plan" />
        <SettingRow title="Safety and buffers" detail="Set confidence and adjust the trip buffer in Plan" />
        <SettingRow title="Arrival reminders" detail="Enable reminders after planning a trip" last />
      </section>
      <InstallAppButton className="mt-5 w-full" />
    </main>
  );
}

function SettingRow({ title, detail, last = false }: { title: string; detail: string; last?: boolean }) {
  return (
    <div className={`px-4 py-4${last ? "" : " border-b border-slate-200"}`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </div>
  );
}
