import { NextResponse } from "next/server";

export const runtime = "edge";

const CURRENT_URL = "https://www.meteo-tech.co.il/eilat-yam/eilat_he.asp";
const DAILY_URL   = "https://www.meteo-tech.co.il/eilat-yam/eilat_daily.asp";
const MS_TO_KT = 1.94384;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
  "Referer": "https://www.meteo-tech.co.il/eilat-yam/",
  "Connection": "keep-alive",
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

function parseWeatherRow(r: string[], timeIsFullDate: boolean) {
  const pIdx = findPressureIdx(r);
  if (pIdx === -1) return null;

  const windspeed = parseFloat(r[pIdx + 5] ?? "");
  const windgust  = parseFloat(r[pIdx + 6] ?? "");

  let timePart: string;
  if (timeIsFullDate) {
    // eilat_he.asp: "DD/MM HH:MM" or just "HH:MM"
    const timeCell = r.find((v) => /\d{2}:\d{2}/.test(v)) ?? "";
    timePart = (timeCell.match(/(\d{2}:\d{2})$/) ?? [])[1] ?? timeCell;
  } else {
    // eilat_daily.asp: "HH:MM"
    timePart = r[0] ?? "";
  }

  return {
    time: timePart,
    temperature: parseFloat(r[pIdx - 3] ?? ""),
    humidity: parseFloat(r[pIdx - 2] ?? ""),
    pressure: parseFloat(r[pIdx] ?? ""),
    winddir: parseFloat(r[pIdx + 4] ?? ""),
    windspeed: isNaN(windspeed) ? NaN : Math.round(windspeed * MS_TO_KT * 10) / 10,
    windgust: isNaN(windgust) ? null : Math.round(windgust * MS_TO_KT * 10) / 10,
  };
}

async function scrapeUrl(url: string, timeIsFullDate: boolean) {
  const res = await fetch(url, { cache: "no-store", headers: BROWSER_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);

  const html = new TextDecoder("iso-8859-1").decode(await res.arrayBuffer());
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
    extractTds(m[1])
  );

  const dataRows = rows.filter((r) => r.length >= 8 && findPressureIdx(r) !== -1);
  if (dataRows.length === 0) throw new Error(`no data rows in ${url} (rows: ${rows.length})`);

  const parsed = parseWeatherRow(dataRows[dataRows.length - 1], timeIsFullDate);
  if (!parsed || isNaN(parsed.windspeed)) throw new Error(`parse failed for ${url}`);
  return parsed;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const debug = searchParams.get("debug") === "1";

  if (debug) {
    // Return raw rows for diagnosis
    try {
      const res = await fetch(CURRENT_URL, { cache: "no-store", headers: BROWSER_HEADERS });
      const html = new TextDecoder("iso-8859-1").decode(await res.arrayBuffer());
      const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => extractTds(m[1]));
      return NextResponse.json({ url: CURRENT_URL, status: res.status, rowCount: rows.length, rows: rows.slice(0, 20) });
    } catch (e) {
      try {
        const res = await fetch(DAILY_URL, { cache: "no-store", headers: BROWSER_HEADERS });
        const html = new TextDecoder("iso-8859-1").decode(await res.arrayBuffer());
        const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => extractTds(m[1]));
        return NextResponse.json({ url: DAILY_URL, status: res.status, rowCount: rows.length, rows: rows.slice(0, 20), heError: String(e) });
      } catch (e2) {
        return NextResponse.json({ heError: String(e), dailyError: String(e2) });
      }
    }
  }

  let scrapeErrors: string[] = [];

  // 1. Try eilat_he.asp (instantaneous)
  try {
    const data = await scrapeUrl(CURRENT_URL, true);
    return NextResponse.json(
      { ...data, source: "meteo-tech" },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    scrapeErrors.push(String(e));
  }

  // 2. Try eilat_daily.asp (10-min averages)
  try {
    const data = await scrapeUrl(DAILY_URL, false);
    return NextResponse.json(
      { ...data, source: "meteo-tech-daily" },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    scrapeErrors.push(String(e));
  }

  // 3. Fallback: Open-Meteo
  try {
    const params = new URLSearchParams({
      latitude: "29.5577",
      longitude: "34.9519",
      current: "windspeed_10m,winddirection_10m,windgusts_10m,temperature_2m",
      wind_speed_unit: "kn",
      timezone: "Asia/Jerusalem",
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { cache: "no-store" });
    const raw = await res.json();
    const c = raw.current;
    return NextResponse.json(
      {
        time: c.time,
        temperature: c.temperature_2m,
        humidity: null,
        pressure: null,
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
