import { fetchWeather, dirLabel, windSummaryHe } from "@/lib/weather";
import SportBadges from "@/components/SportBadges";
import WindCompass from "@/components/WindCompass";
import WindChart from "@/components/WindChart";
import DayCard from "@/components/DayCard";
import WindyMap from "@/components/WindyMap";
import WebcamSection from "@/components/WebcamSection";
import Link from "next/link";

export const revalidate = 1800;

function WindSpeedBig({ speed, label }: { speed: number; label: string }) {
  const color =
    speed >= 12 && speed <= 30
      ? "text-emerald-400"
      : speed >= 8
      ? "text-amber-400"
      : "text-slate-400";
  return (
    <div className="text-center">
      <div className={`text-5xl font-bold tabular-nums ${color}`}>{Math.round(speed)}</div>
      <div className="text-slate-400 text-sm mt-1">{label}</div>
    </div>
  );
}

export default async function HomePage() {
  const { current, hourly, days } = await fetchWeather();

  const next24h = hourly
    .filter((h) => new Date(h.time) >= new Date(current.time))
    .slice(0, 24);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
      {/* Hero */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-sm font-medium">Live · Eilat, Israel</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-6">Wind right now</h1>

        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
          <div className="flex flex-wrap items-center gap-8 mb-6">
            <WindCompass direction={current.winddirection} size={96} />
            <div className="flex gap-6 flex-wrap">
              <WindSpeedBig speed={current.windspeed} label="Wind (kt)" />
              {current.windgust != null && (
                <WindSpeedBig speed={current.windgust} label="Gusts (kt)" />
              )}
              <div className="text-center">
                <div className="text-5xl font-bold text-slate-300">{dirLabel(current.winddirection)}</div>
                <div className="text-slate-400 text-sm mt-1">Direction</div>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold text-slate-300">{Math.round(current.temperature)}°</div>
                <div className="text-slate-400 text-sm mt-1">Temp (°C)</div>
              </div>
            </div>
          </div>

          {/* Hebrew wind summary */}
          <div
            dir="rtl"
            lang="he"
            className="mt-5 rounded-lg bg-slate-800/60 border border-slate-700 px-4 py-3 text-right text-slate-200 text-sm leading-relaxed"
          >
            {windSummaryHe(current.windspeed, current.winddirection, current.windgust)}
          </div>

          <div className="mt-4">
            <SportBadges windspeed={current.windspeed} large />
          </div>
        </div>
      </section>

      {/* Next 24h chart */}
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
