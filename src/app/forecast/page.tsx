import { fetchWeather, formatDate, dirLabel } from "@/lib/weather";
import { SPORTS, rate, RATING_STYLES } from "@/lib/suitability";
import WindChart from "@/components/WindChart";
import SportBadges from "@/components/SportBadges";

export const dynamic = "force-dynamic";

export default async function ForecastPage() {
  const { days } = await fetchWeather();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-2">16-Day Wind Forecast</h1>
      <p className="text-slate-400 mb-8">Eilat, Israel · Data from Open-Meteo</p>

      {/* Quick overview strip */}
      <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-16 gap-1 mb-10">
        {days.map((day, i) => {
          const rating = rate(day.avgWind, SPORTS[0]);
          const bg =
            rating === "go"
              ? "bg-emerald-500/20 border-emerald-500/30"
              : rating === "marginal"
              ? "bg-amber-500/20 border-amber-500/30"
              : "bg-slate-800 border-slate-700";
          return (
            <a
              key={day.date}
              href={`#day-${i}`}
              className={`rounded-lg border p-2 text-center hover:brightness-125 transition ${bg}`}
            >
              <div className="text-[10px] text-slate-400">
                {i === 0 ? "Today" : new Date(day.date + "T12:00:00").toLocaleDateString("en-IL", { weekday: "short" })}
              </div>
              <div className="text-sm font-bold text-white mt-0.5">{day.avgWind}</div>
              <div className="text-[10px] text-slate-500">kt</div>
            </a>
          );
        })}
      </div>

      {/* Day-by-day details */}
      <div className="space-y-8">
        {days.map((day, i) => (
          <section key={day.date} id={`day-${i}`} className="scroll-mt-20">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-4 p-5 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {i === 0 ? "Today — " : ""}
                    {formatDate(day.date)}
                  </h2>
                  <div className="text-slate-400 text-sm mt-0.5">
                    Wind {day.minWind}–{day.maxWind} kt · Gusts up to {day.maxGust} kt · From {dirLabel(day.dominantDir)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{day.avgWind}</div>
                    <div className="text-xs text-slate-500">avg kt</div>
                  </div>
                  <SportBadges windspeed={day.avgWind} />
                </div>
              </div>

              <div className="p-4">
                <WindChart hours={day.hours} />
              </div>

              {/* Hourly table */}
              <div className="overflow-x-auto border-t border-slate-800">
                <table className="w-full text-xs text-slate-400">
                  <thead>
                    <tr className="border-b border-slate-800">
                      {["Time", "Wind (kt)", "Gusts (kt)", "Dir", ...SPORTS.map((s) => s.emoji)].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {day.hours.filter((_, idx) => idx % 3 === 0).map((h) => {
                      const time = new Date(h.time).toLocaleTimeString("en-IL", {
                        hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem",
                      });
                      return (
                        <tr key={h.time} className="border-b border-slate-800/50 hover:bg-slate-800/40">
                          <td className="px-3 py-2 text-slate-300">{time}</td>
                          <td className="px-3 py-2 font-medium text-white">{Math.round(h.windspeed)}</td>
                          <td className="px-3 py-2 text-amber-400">{Math.round(h.windgusts)}</td>
                          <td className="px-3 py-2">{dirLabel(h.winddirection)}</td>
                          {SPORTS.map((sport) => {
                            const r = rate(h.windspeed, sport);
                            const s = RATING_STYLES[r];
                            return (
                              <td key={sport.id} className={`px-3 py-2 font-bold ${s.text}`}>
                                {s.label}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
