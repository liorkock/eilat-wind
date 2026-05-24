import { NextResponse } from "next/server";

// Instantaneous readings page (updates every ~10 min)
const CURRENT_URL = "https://www.meteo-tech.co.il/eilat-yam/eilat_he.asp";
const MS_TO_KT = 1.94384;

function extractTds(rowHtml: string): string[] {
  return [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, "").trim());
}

/**
 * Find the index of a value within a plausible pressure range (950–1050).
 * Returns -1 if not found.
 */
function findPressureIdx(r: string[]): number {
  return r.findIndex((v) => {
    const n = parseFloat(v);
    return !isNaN(n) && n >= 950 && n <= 1100;
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const debug = searchParams.get("debug") === "1";

  try {
    const res = await fetch(CURRENT_URL, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (compatible)" },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = new TextDecoder("iso-8859-1").decode(await res.arrayBuffer());

    const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
      extractTds(m[1])
    );

    if (debug) {
      return NextResponse.json({ rowCount: rows.length, rows: rows.slice(0, 20) });
    }

    // Find the data row: must contain a pressure value (950–1100) and have enough columns
    const dataRows = rows.filter((r) => r.length >= 8 && findPressureIdx(r) !== -1);

    if (dataRows.length === 0) throw new Error(`no data rows found (total rows: ${rows.length})`);

    const r = dataRows[dataRows.length - 1];
    const pIdx = findPressureIdx(r);

    // Layout relative to pressure index (pIdx):
    //   pIdx-3: Temp, pIdx-2: Humidity, pIdx-1: (dewpoint or other), pIdx: Pressure
    // After pressure: Solar, ?, ?, WindDir, WindSpeed(m/s), WindGust(m/s), ...
    // Based on observed data at 09:20:
    //   r[1]=Temp, r[2]=Humidity, r[3]=DewPoint, r[4]=Pressure → pIdx=4
    //   r[8]=WindDir, r[9]=WindSpeed m/s, r[10]=WindGust m/s
    const tempIdx = pIdx - 3;
    const humIdx  = pIdx - 2;
    const wdirIdx = pIdx + 4;
    const wspIdx  = pIdx + 5;
    const wguIdx  = pIdx + 6;

    const windspeed = parseFloat(r[wspIdx] ?? "");
    const windgust  = parseFloat(r[wguIdx] ?? "");

    // Time: look for a cell containing ":" (HH:MM) or "/" (date)
    const timeCell = r.find((v) => /\d{2}:\d{2}/.test(v)) ?? "";
    const timeMatch = timeCell.match(/(\d{2}:\d{2})$/);
    const timePart = timeMatch ? timeMatch[1] : timeCell;

    return NextResponse.json(
      {
        time: timePart,
        temperature: parseFloat(r[tempIdx] ?? ""),
        humidity: parseFloat(r[humIdx] ?? ""),
        pressure: parseFloat(r[pIdx] ?? ""),
        winddir: parseFloat(r[wdirIdx] ?? ""),
        windspeed: Math.round(windspeed * MS_TO_KT * 10) / 10,
        windgust: isNaN(windgust) ? null : Math.round(windgust * MS_TO_KT * 10) / 10,
        source: "meteo-tech",
        _idx: debug ? { pIdx, tempIdx, humIdx, wdirIdx, wspIdx, wguIdx, row: r } : undefined,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    // Fallback to Open-Meteo
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
          scrapeError: String(err),
        },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    } catch (fallbackErr) {
      return NextResponse.json({ error: String(err), fallbackError: String(fallbackErr) }, { status: 502 });
    }
  }
}
