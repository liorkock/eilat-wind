import { NextResponse } from "next/server";

// Instantaneous readings page (updates every ~10 min)
const CURRENT_URL = "https://www.meteo-tech.co.il/eilat-yam/eilat_he.asp";
const MS_TO_KT = 1.94384;

function extractTds(rowHtml: string): string[] {
  return [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, "").trim());
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

    // eilat_he.asp time format: "DD/MM HH:MM"
    // Columns (0-based): Time | Temp | Humidity | DewPoint | Pressure | Solar | ? | ? | WindDir | WindSpeed(m/s) | WindGust(m/s) | Visibility | SeaTemp
    const dataRows = rows.filter(
      (r) =>
        /^\d{2}\/\d{2} \d{2}:\d{2}$/.test(r[0] ?? "") &&
        !isNaN(parseFloat(r[9] ?? ""))
    );

    if (dataRows.length === 0) throw new Error("no data rows found");

    const r = dataRows[dataRows.length - 1];

    const windspeed = parseFloat(r[9]);
    const windgust = parseFloat(r[10]);

    // Extract time portion "HH:MM" from "DD/MM HH:MM"
    const timePart = (r[0] ?? "").split(" ")[1] ?? r[0];

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
        },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    } catch {
      return NextResponse.json({ error: String(err) }, { status: 502 });
    }
  }
}
