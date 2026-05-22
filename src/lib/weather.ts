export const EILAT = { lat: 29.5577, lon: 34.9519, timezone: 'Asia/Jerusalem' };

export interface CurrentWeather {
  time: string;
  temperature: number;
  windspeed: number;
  windgust?: number;
  winddirection: number;
  is_day: number;
}

export interface HourlyEntry {
  time: string;
  windspeed: number;
  windgusts: number;
  winddirection: number;
  temperature: number;
}

export interface DayForecast {
  date: string;
  hours: HourlyEntry[];
  avgWind: number;
  minWind: number;
  maxWind: number;
  maxGust: number;
  dominantDir: number;
}

export interface WeatherData {
  current: CurrentWeather;
  hourly: HourlyEntry[];
  days: DayForecast[];
}

export async function fetchWeather(): Promise<WeatherData> {
  const { lat, lon, timezone } = EILAT;
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'windspeed_10m,winddirection_10m,windgusts_10m,temperature_2m',
    wind_speed_unit: 'kn',
    forecast_days: '16',
    current_weather: 'true',
    timezone,
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`Weather API ${res.status}`);

  const raw = await res.json();
  return parse(raw);
}

function parse(raw: Record<string, unknown>): WeatherData {
  const cw = raw.current_weather as Record<string, number & string>;
  const h = raw.hourly as Record<string, unknown[]>;

  const hourly: HourlyEntry[] = (h.time as string[]).map((t, i) => ({
    time: t,
    windspeed: h.windspeed_10m[i] as number,
    windgusts: h.windgusts_10m[i] as number,
    winddirection: h.winddirection_10m[i] as number,
    temperature: h.temperature_2m[i] as number,
  }));

  const currentIdx = hourly.findIndex((e) => e.time === cw.time);
  const current: CurrentWeather = {
    time: cw.time as unknown as string,
    temperature: cw.temperature as unknown as number,
    windspeed: cw.windspeed as unknown as number,
    winddirection: cw.winddirection as unknown as number,
    is_day: cw.is_day as unknown as number,
    windgust: currentIdx >= 0 ? hourly[currentIdx].windgusts : undefined,
  };

  const dayMap = new Map<string, HourlyEntry[]>();
  for (const entry of hourly) {
    const day = entry.time.slice(0, 10);
    if (!dayMap.has(day)) dayMap.set(day, []);
    dayMap.get(day)!.push(entry);
  }

  const days: DayForecast[] = Array.from(dayMap.entries()).map(([date, hours]) => {
    const speeds = hours.map((h) => h.windspeed);
    const gusts = hours.map((h) => h.windgusts);
    return {
      date,
      hours,
      avgWind: Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length),
      minWind: Math.round(Math.min(...speeds)),
      maxWind: Math.round(Math.max(...speeds)),
      maxGust: Math.round(Math.max(...gusts)),
      dominantDir: circularMean(hours.map((h) => h.winddirection)),
    };
  });

  return { current, hourly, days };
}

function circularMean(degrees: number[]): number {
  const sin = degrees.reduce((s, d) => s + Math.sin((d * Math.PI) / 180), 0);
  const cos = degrees.reduce((s, d) => s + Math.cos((d * Math.PI) / 180), 0);
  const avg = (Math.atan2(sin, cos) * 180) / Math.PI;
  return Math.round(avg < 0 ? avg + 360 : avg);
}

export function dirLabel(deg: number): string {
  const labels = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return labels[Math.round(deg / 22.5) % 16];
}

export function formatTime(isoTime: string): string {
  return new Date(isoTime).toLocaleTimeString('en-IL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: EILAT.timezone,
  });
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IL', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
