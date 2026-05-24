import { NextResponse } from "next/server";

export const runtime = "edge";

// meteo-tech.co.il is behind Cloudflare which blocks datacenter IPs (Vercel, etc.)
// Data is populated every 5 min by GitHub Actions (.github/workflows/fetch-weather.yml)
// which runs on GitHub's servers (not blocked) and stores in Vercel KV.
const CURRENT_URL = "http://www.meteo-tech.co.il/eilat-yam/eilat_he.asp";
const DAILY_URL   = "http://www.meteo-tech.co.il/eilat-yam/eilat_daily.asp";
const MS_TO_KT = 1.94384;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8",
  "Referer": "http://www.meteo-tech.co.il/eilat-yam/",
};

function extractTds(rowHtml: string): string[] {
  return [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, "").trim());
}

function findPressureIdx(r: string[]): number {
  return r.findIndex((v) => {
    const n = parseFloat(v);
    return !isNaN(n) && n >= 950 && n <= 1100;
  });
}

function parseWeatherRow(r: string[]) {
  const pIdx = findPressureIdx(r);
  if (pIdx < 2) return null;

  // Column layout anchored to pressure (pIdx):
  //   pIdx-3: Temp | pIdx-2: Humidity | pIdx: Pressure
  //   pIdx+2: WindDir | pIdx+3: WindSpeed(m/s) | pIdx+4: WindGust(m/s)
  const windspeed = parseFloat(r[pIdx + 3] ?? "");
  const windgust  = parseFloat(r[pIdx + 4] ?? "");
  const winddir   = parseFloat(r[pIdx + 2] ?? "");
  if (isNaN(windspeed) || isNaN(winddir)) return null;

  const timeCell = r.find((v) => /\d{2}:\d{2}/.test(v)) ?? r[0] ?? "";
  const timePart = (timeCell.match(/(\d{2}:\d{2})$/) ?? [])[1] ?? timeCell;

  return {
    time: timePart,
    temperature: parseFloat(r[pIdx - 3] ?? ""),
    humidity: parseFloat(r[pIdx - 2] ?? ""),
    pressure: parseFloat(r[pIdx] ?? ""),
    winddir,
    windspeed: Math.round(windspeed * MS_TO_KT * 10) / 10,
    windgust: isNaN(windgust) ? null : Math.round(windgust * MS_TO_KT * 10) / 10,
  };
}

async function scrapeUrl(url: string) {
  const res = await fetch(url, { cache: "no-store", headers: BROWSER_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const html = new TextDecoder("iso-8859-1").decode(await res.arrayBuffer());
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
    extractTds(m[1])
  );
  const dataRows = rows.filter((r) => r.length >= 8 && findPressureIdx(r) >= 2);
  if (dataRows.length === 0) throw new Error(`no data rows in ${url}`);
  const parsed = parseWeatherRow(dataRows[dataRows.length - 1]);
  if (!parsed) throw new Error(`parse failed for ${url}`);
  return parsed;
}

async function readFromKV() {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) throw new Error("KV not configured");

  const res = await fetch(`${kvUrl}/get/eilat_weather`, {
    headers: { Authorization: `Bearer ${kvToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KV HTTP ${res.status}`);
  const { result } = await res.json() as { result: string | null };
  if (!result) throw new Error("KV empty");
  const data = JSON.parse(result);

  // Check freshness — reject if older than 15 minutes
  if (data.fetchedAt) {
    const age = Date.now() - new Date(data.fetchedAt).getTime();
    if (age > 15 * 60 * 1000) throw new Error(`KV stale (${Math.round(age / 60000)} min old)`);
  }
  return data;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const debug = searchParams.get("debug") === "1";

  if (debug) {
    const errors: Record<string, string> = {};
    // Try direct scrape for debug info
    for (const url of [CURRENT_URL, DAILY_URL]) {
      try {
        const res = await fetch(url, { cache: "no-store", headers: BROWSER_HEADERS });
        const html = new TextDecoder("iso-8859-1").decode(await res.arrayBuffer());
        const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => extractTds(m[1]));
        return NextResponse.json({ url, status: res.status, rowCount: rows.length, rows: rows.slice(0, 15) });
      } catch (e) {
        errors[url] = String(e);
      }
    }
    return NextResponse.json({ errors });
  }

  const scrapeErrors: string[] = [];

  // 1. Try Vercel KV (populated every 5 min by GitHub Actions)
  try {
    const data = await readFromKV();
    return NextResponse.json(
      { ...data, source: "meteo-tech" },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    scrapeErrors.push(`KV: ${e}`);
  }

  // 2. Try direct scrape (works if not behind Cloudflare / running locally)
  for (const url of [CURRENT_URL, DAILY_URL]) {
    try {
      const data = await scrapeUrl(url);
      return NextResponse.json(
        { ...data, source: url.includes("eilat_he") ? "meteo-tech" : "meteo-tech-daily" },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    } catch (e) {
      scrapeErrors.push(String(e));
    }
  }

  // 3. Open-Meteo fallback
  try {
    const params = new URLSearchParams({
      latitude: "29.5577",
      longitude: "34.9519",
      current: [
        "windspeed_10m",
        "winddirection_10m",
        "windgusts_10m",
        "temperature_2m",
        "relativehumidity_2m",
        "surface_pressure",
      ].join(","),
      wind_speed_unit: "kn",
      timezone: "Asia/Jerusalem",
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { cache: "no-store" });
    const raw = await res.json() as { current: Record<string, number> };
    const c = raw.current;
    return NextResponse.json(
      {
        time: c.time,
        temperature: c.temperature_2m,
        humidity: c.relativehumidity_2m ?? null,
        pressure: c.surface_pressure ?? null,
        winddir: c.winddirection_10m,
        windspeed: c.windspeed_10m,
        windgust: c.windgusts_10m,
        source: "open-meteo-fallback",
        scrapeErrors,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    return NextResponse.json(
      { error: "all sources failed", scrapeErrors, openMeteoError: String(e) },
      { status: 502 }
    );
  }
}
