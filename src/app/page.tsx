import { fetchWeather } from "@/lib/weather";
import WindChart from "@/components/WindChart";
import DayCard from "@/components/DayCard";
import WindyMap from "@/components/WindyMap";
import WebcamSection from "@/components/WebcamSection";
import LiveCard, { type LiveData } from "@/components/LiveCard";
import Link from "next/link";

export const revalidate = 1800;

export default async function HomePage() {
  // Fetch forecast + initial live data in parallel
  const [{ hourly, days, current }, liveRes] = await Promise.all([
    fetchWeather(),
    fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3001"}/api/current`, {
      cache: "no-store",
    }).catch(() => null),
  ]);

  const initial: LiveData = liveRes?.ok
    ? await liveRes.json()
    : {
        time: current.time,
        temperature: current.temperature,
        humidity: null,
        pressure: null,
        winddir: current.winddirection,
        windspeed: current.windspeed,
        windgust: current.windgust ?? null,
        source: "open-meteo-fallback",
      };

  const next24h = hourly
    .filter((h) => new Date(h.time) >= new Date(current.time))
    .slice(0, 24);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
      {/* Live hero */}
      <section>
        <h1 className="text-3xl font-bold text-white mb-4">Wind right now</h1>
        <LiveCard initial={initial} />
      </section>

      {/* Next 24h forecast chart */}
      <section>
        <h2 className="text-xl font-bold text-white mb-4">Next 24 hours</h2>
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
          <WindChart hours={next24h} />
        </div>
      </section>

      {/* 7-day overview */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">7-Day Forecast</h2>
          <Link href="/forecast" className="text-cyan-400 text-sm hover:text-cyan-300 transition-colors">
            See all 16 days →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {days.slice(0, 7).map((day, i) => (
            <DayCard key={day.date} day={day} index={i} isToday={i === 0} />
          ))}
        </div>
      </section>

      {/* Windy map */}
      <section>
        <h2 className="text-xl font-bold text-white mb-4">🗺️ Wind Map</h2>
        <WindyMap />
      </section>

      {/* Webcams & resources */}
      <WebcamSection />
    </div>
  );
}
