"use client";

import { useEffect, useState, useCallback } from "react";
import WindCompass from "./WindCompass";
import SportBadges from "./SportBadges";
import { dirLabel, windSummaryHe } from "@/lib/weather";

export interface LiveData {
  time: string;
  temperature: number;
  humidity: number | null;
  pressure: number | null;
  winddir: number;
  windspeed: number;
  windgust: number | null;
  source: string;
}

const POLL_MS = 30_000;

function isLive(source: string) {
  return source === "meteo-tech" || source === "meteo-tech-daily" || source === "ims";
}

function sourceLabel(source: string) {
  if (source === "meteo-tech" || source === "meteo-tech-daily") return "Live · Meteo-Tech Eilat";
  if (source === "ims") return "Live · IMS Ramon Airport";
  return "⚠ Forecast model · Open-Meteo";
}

function BigStat({ value, unit, label, color }: { value: string; unit?: string; label: string; color?: string }) {
  return (
    <div className="text-center">
      <div className={`text-5xl font-bold tabular-nums ${color ?? "text-slate-300"}`}>
        {value}
        {unit && <span className="text-2xl font-normal text-slate-500 ml-1">{unit}</span>}
      </div>
      <div className="text-slate-400 text-sm mt-1">{label}</div>
    </div>
  );
}

function windColor(speed: number) {
  if (speed >= 12 && speed <= 30) return "text-emerald-400";
  if (speed >= 8) return "text-amber-400";
  return "text-slate-400";
}

export default function LiveCard({ initial }: { initial: LiveData }) {
  const [data, setData] = useState<LiveData>(initial);
  const [updatedAt, setUpdatedAt] = useState<Date>(new Date());
  const [stale, setStale] = useState(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/current", { cache: "no-store" });
      if (!res.ok) throw new Error("fetch failed");
      const json: LiveData = await res.json();
      setData(json);
      setUpdatedAt(new Date());
      setStale(false);
    } catch {
      setStale(true);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  const secondsAgo = Math.round((Date.now() - updatedAt.getTime()) / 1000);

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
      {/* Status bar */}
      <div className="flex items-center justify-between mb-5 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${stale ? "bg-amber-500" : "bg-emerald-400 animate-pulse"}`} />
          <span className={stale ? "text-amber-400" : isLive(data.source) ? "text-emerald-400" : "text-amber-400"}>
            {stale ? "Reconnecting…" : sourceLabel(data.source)}
          </span>
        </div>
        <span>
          Station time: <span className="text-slate-300 font-medium">{data.time}</span>
          {" · "}updated {secondsAgo}s ago
        </span>
      </div>

      {/* Main stats */}
      <div className="flex flex-wrap items-center gap-8 mb-5">
        <WindCompass direction={data.winddir} size={96} />
        <div className="flex gap-6 flex-wrap">
          <BigStat
            value={String(Math.round(data.windspeed))}
            label="Wind (kt)"
            color={windColor(data.windspeed)}
          />
          {data.windgust != null && (
            <BigStat
              value={String(Math.round(data.windgust))}
              label="Gusts (kt)"
              color="text-amber-400"
            />
          )}
          <BigStat value={dirLabel(data.winddir)} label="Direction" />
          <BigStat value={`${Math.round(data.temperature)}°`} label="Temp (°C)" />
          {data.humidity != null && (
            <BigStat value={`${Math.round(data.humidity)}%`} label="Humidity" />
          )}
        </div>
      </div>

      {/* Hebrew summary */}
      <div
        dir="rtl"
        lang="he"
        className="rounded-lg bg-slate-800/60 border border-slate-700 px-4 py-3 text-right text-slate-200 text-sm leading-relaxed mb-4"
      >
        {windSummaryHe(data.windspeed, data.winddir, data.windgust ?? undefined)}
      </div>

      <SportBadges windspeed={data.windspeed} large />
    </div>
  );
}
