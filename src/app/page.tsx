import { fetchWeather } from "@/lib/weather";
import WindChart from "@/components/WindChart";
import DayCard from "@/components/DayCard";
import WindyMap from "@/components/WindyMap";
import WebcamSection from "@/components/WebcamSection";
import LiveCard, { type LiveData } from "@/components/LiveCard";
import Link from "next/link";

export const revalidate = 1800;

const FALLBACK_INITIAL: LiveData = {
  time: "--:--",
  temperature: 0,
  humidity: null,
  pressure: null,
  winddir: 0,
  windspeed: 0,
  windgust: null,
  source: "loading",
};

export default async function HomePage() {
  let hourly: Awaited<ReturnType<typeof fetchWeather>>["hourly"] = [];
  let days: Awaited<ReturnType<typeof fetchWeather>>["days"] = [];
  let initial: LiveData = FALLBACK_INITIAL;

  try {
    const { hourly: h, days: d } = await fetchWeather();
    hourly = h;
    days = d;
  } catch {
    // Forecast data unavailable at build time — charts will be empty
  }

  // Fetch real-time data for the initial render (METAR station data)
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3001";
    const res = await fetch(`${base}/api/current`, { cache: "no-store" });
    if (res.ok) initial = await res.json() as LiveData;
  } catch {
    // LiveCard will populate via client polling within 30s
  }

  const next24h = hourly.slice(0, 24);

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
