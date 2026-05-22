import { DayForecast, dirLabel, formatDate } from "@/lib/weather";
import { SPORTS, rate, RATING_STYLES } from "@/lib/suitability";
import Link from "next/link";

interface Props {
  day: DayForecast;
  index: number;
  isToday?: boolean;
}

function WindBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = value >= 12 && value <= 30 ? "bg-emerald-500" : value >= 8 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function DayCard({ day, index, isToday }: Props) {
  const dominantRating = rate(day.avgWind, SPORTS[0]);
  const borderColor = dominantRating === "go" ? "border-emerald-500/30" : dominantRating === "marginal" ? "border-amber-500/30" : "border-slate-800";

  return (
    <Link
      href={`/forecast#day-${index}`}
      className={`block bg-slate-900 rounded-xl border ${borderColor} p-4 hover:bg-slate-800/80 transition-colors group`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wide">
            {isToday ? "Today" : formatDate(day.date)}
          </div>
          <div className="text-lg font-bold text-white mt-0.5">
            {day.avgWind}
            <span className="text-slate-400 text-sm font-normal"> kt avg</span>
          </div>
        </div>
        <div className="text-right text-xs text-slate-400">
          <div>↑ {day.maxWind} kt</div>
          <div className="text-amber-400">💨 {day.maxGust} kt</div>
        </div>
      </div>

      <WindBar value={day.avgWind} max={40} />

      <div className="mt-3 text-xs text-slate-500">
        From {dirLabel(day.dominantDir)} · {day.minWind}–{day.maxWind} kt range
      </div>

      <div className="mt-3 flex gap-1.5 flex-wrap">
        {SPORTS.map((sport) => {
          const r = rate(day.avgWind, sport);
          const s = RATING_STYLES[r];
          return (
            <span key={sport.id} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s.bg} ${s.text} border ${s.border}`}>
              {sport.emoji} {s.label}
            </span>
          );
        })}
      </div>
    </Link>
  );
}
