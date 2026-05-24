import { NextResponse } from "next/server";

// Instantaneous readings page (updates every ~10 min)
const CURRENT_URL = "https://www.meteo-tech.co.il/eilat-yam/eilat_he.asp";
const MS_TO_KT = 1.94384;

function extractTds(rowHtml: string): string[] {
  return [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, "").trim());
}

/**
 * eilat_he.asp column layout (0-based, 13 columns total):
 *   0: Time (DD/MM HH:MM)
 *   1: Temperature (°C)
 *   2: Humidity (%)
 *   3: DewPoint (°C)
 *   4: Pressure (hPa) — typically 950–1050
 *   5: Solar/PAR
 *   6: (radiation sensor)
 *   7: (radiation sensor)
 *   8: WindDir (degrees 0–360)
 *   9: WindSpeed (m/s)
 *  10: WindGust (m/s)
 *  11: Visibility (km)
 *  12: SeaTemp (°C)
 */
function isDataRow(r: string[]): boolean {
  if (r.length < 11) return false;
  // Must have a date/time-like value in first cell (contains "/" and ":")
  const t = r[0] ?? "";
  if (!t.includes("/") && !t.includes(":")) return false;
  // Pressure at index 4 should be in realistic range
  const pressure = parseFloat(r[4] ?? "");
  if (isNaN(pressure) || pressure < 900 || pressure > 1100) return false;
  // Wind speed at index 9 should be numeric and reasonable
  const ws = parseFloat(r[9] ?? "");
  if (isNaN(ws) || ws < 0 || ws > 60) return false;
  return true;
}

export async function GET() {
  try {
    const res = await fetch(CURRENT_URL, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (compatible)" },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Decode as iso-8859-1 — Hebrew page encoding
    const html = new TextDecoder("iso-8859-1").decode(await res.arrayBuffer());

    // Extract all <tr> blocks and their TD values
    const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
      extractTds(m[1])
    );

    const dataRows = rows.filter(isDataRow);

    if (dataRows.length === 0) throw new Error("no data rows found");

    // Use the last (most recent) data row
    const r = dataRows[dataRows.length - 1];

    const windspeed = parseFloat(r[9]);
    const windgust = parseFloat(r[10]);

    // Extract HH:MM from time cell (format: "DD/MM HH:MM" or just "HH:MM")
    const timeMatch = (r[0] ?? "").match(/(\d{2}:\d{2})$/);
    const timePart = timeMatch ? timeMatch[1] : r[0];

    return NextResponse.json(
      {
        time: timePart,
        temperature: parseFloat(r[1]),
        humidity: parseFloat(r[2]),
        pressure: parseFloat(r[4]),
        winddir: parseFloat(r[8]),
        windspeed: Math.round(windspeed * MS_TO_KT * 10) / 10,
        windgust: isNaN(windgust) ? null : Math.round(windgust * MS_TO_KT * 10) / 10,
        source: "meteo-tech",
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
