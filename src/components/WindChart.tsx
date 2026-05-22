"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from "recharts";
import type { HourlyEntry } from "@/lib/weather";

interface Props {
  hours: HourlyEntry[];
  /** Show only next N hours */
  limit?: number;
}

function fmt(isoTime: string) {
  return new Date(isoTime).toLocaleTimeString("en-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
}

export default function WindChart({ hours, limit }: Props) {
  const data = (limit ? hours.slice(0, limit) : hours).map((h) => ({
    time: fmt(h.time),
    Wind: Math.round(h.windspeed),
    Gusts: Math.round(h.windgusts),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="windGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gustGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="time"
          tick={{ fill: "#64748b", fontSize: 11 }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          unit=" kt"
        />
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
          labelStyle={{ color: "#94a3b8", fontSize: 12 }}
          itemStyle={{ fontSize: 13 }}
          formatter={(v, name) => [`${v} kt`, String(name)]}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "#94a3b8" }}
          iconType="circle"
          iconSize={8}
        />
        {/* Kite go-zone reference band */}
        <ReferenceLine y={12} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: "Kite min", position: "right", fill: "#22c55e", fontSize: 10 }} />
        <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: "Kite max", position: "right", fill: "#f59e0b", fontSize: 10 }} />
        <Area type="monotone" dataKey="Gusts" stroke="#f59e0b" strokeWidth={1.5} fill="url(#gustGrad)" dot={false} />
        <Area type="monotone" dataKey="Wind" stroke="#06b6d4" strokeWidth={2} fill="url(#windGrad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
