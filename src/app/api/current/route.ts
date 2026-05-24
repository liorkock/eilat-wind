import { NextResponse } from "next/server";

export const runtime = "edge";

// ─── Data source URLs ───────────────────────────────────────────────────────
// IMS (Israel Met Service) public XML – updated hourly, no auth, accessible from Vercel
const IMS_XML_URL = "https://ims.gov.il/sites/default/files/ims_data/xml_files/observ.xml";

// GitHub Gist – populated every 5 min by GitHub Actions fetching meteo-tech.co.il
// (meteo-tech is behind Cloudflare and blocks all cloud IPs; GitHub Actions also blocked)
const GIST_RAW = "https://gist.githubusercontent.com/liorkock/4f4cb7be778600828312b7b84263c356/raw/weather.json";

// meteo-tech direct URLs (will 403 from Vercel but kept for local dev)
const METEO_TECH_URL = "http://www.meteo-tech.co.il/eilat-yam/eilat_he.asp";
const METEO_DAILY_URL = "http://www.meteo-tech.co.il/eilat-yam/eilat_daily.asp";

const MS_TO_KT = 1.94384;

// ─── IMS XML parser ──────────────────────────────────────────────────────────
// IMS stations near Eilat (preference order):
//   206 = Eilat city station
//   495 = Ramon Airport IAA (18 km north, same wind regime)
const IMS_STATION_PRIORITY = [206, 495];

interface ImsData {
  time: string;
  temperature: number | null;
  humidity: number | null;
  pressure: number | null;
  winddir: number;
  windspeed: number;  // knots
  windgust: number | null;  // knots
  source: "ims";
  stationId: number;
}

function parseImsXml(xml: string): ImsData | null {
  for (const stationId of IMS_STATION_PRIORITY) {
    // Extract the <Observation> block for this station
    const obsMatch = xml.match(
      new RegExp(
        `<Observation>[\\s\\S]*?<StationNumber>${stationId}<\\/StationNumber>[\\s\\S]*?<\\/Observation>`
      )
    );
    if (!obsMatch) continue;
    const obs = obsMatch[0];

    // Extract DateTime
    const dtMatch = obs.match(/<DateTime>([^<]+)<\/DateTime>/);
    const dtStr = dtMatch ? dtMatch[1].trim() : "";
    // Format: "YYYY-MM-DD HH:MM" → extract HH:MM
    const timeMatch = dtStr.match(/(\d{2}:\d{2})$/);
    const timePart = timeMatch ? timeMatch[1] : dtStr;

    // Extract all parameters into a map
    const params: Record<string, number> = {};
    const paramRe = /<ParameterShortName>(\w+)<\/ParameterShortName>\s*<ParameterValue>(-?[\d.]+)<\/ParameterValue>/g;
    let m: RegExpExecArray | null;
    while ((m = paramRe.exec(obs)) !== null) {
      params[m[1]] = parseFloat(m[2]);
    }

    // IMS parameter units:
    //   FF  = wind speed   (tenths of m/s)  → ÷10 × 1.94384 = kt
    //   DD  = wind dir     (degrees)
    //   FM  = 3h gust      (tenths of m/s)
    //   FFX = 3h max wind  (tenths of m/s)
    //   T   = temperature  (tenths of °C)
    //   RH  = humidity     (%)
    //   P0  = pressure     (tenths of hPa)
    const ff = params["FF"] ?? null;
    if (ff === null) continue;   // no wind data for this station

    const dd  = params["DD"] ?? null;
    if (dd === null) continue;

    const fm  = params["FM"] ?? params["FFX"] ?? null;
    const t   = params["T"]  ?? params["TD"] ?? null;
    const rh  = params["RH"] ?? null;
    const p0  = params["P0"] ?? params["PPPP"] ?? null;

    return {
      time: timePart,
      temperature: t !== null ? Math.round(t / 10 * 10) / 10 : null,
      humidity: rh ?? null,
      pressure: p0 !== null ? Math.round(p0 / 10 * 10) / 10 : null,
      winddir: dd,
      windspeed: Math.round((ff / 10) * MS_TO_KT * 10) / 10,
      windgust: fm !== null ? Math.round((fm / 10) * MS_TO_KT * 10) / 10 : null,
      source: "ims",
      stationId,
    };
  }
  return null;
}

async function fetchImsData(): Promise<ImsData> {
  const res = await fetch(IMS_XML_URL, {
    cache: "no-store",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/xml,application/xml,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8",
      "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8",
      "Referer": "https://ims.gov.il/he/CurrentDataXML",
    },
  });
  if (!res.ok) throw new Error(`IMS HTTP ${res.status}`);
  const xml = await res.text();
  const data = parseImsXml(xml);
  if (!data) throw new Error("IMS: no station data found for Eilat/Ramon");
  return data;
}

// ─── GitHub Gist (meteo-tech data, updated every 5 min by GitHub Actions) ───
async function fetchGistData() {
  const url = `${GIST_RAW}?t=${Math.floor(Date.now() / 30000)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Gist HTTP ${res.status}`);
  const data = await res.json() as Record<string, unknown>;
  if (!data.windspeed) throw new Error("Gist data missing windspeed");
  if (data.fetchedAt) {
    const age = Date.now() - new Date(data.fetchedAt as string).getTime();
    if (age > 15 * 60 * 1000) throw new Error(`Gist stale (${Math.round(age / 60000)} min old)`);
  }
  return data;
}

// ─── meteo-tech direct scraper (works locally; 403 from cloud IPs) ───────────
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "text/html,application/xhtml+xml",
  "Accept-Language": "he-IL,he;q=0.9",
  "Referer": "http://www.meteo-tech.co.il/eilat-yam/",
};

function extractTds(rowHtml: string) {
  return [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, "").trim());
}

function findPressureIdx(r: string[]) {
  return r.findIndex((v) => { const n = parseFloat(v); return !isNaN(n) && n >= 950 && n <= 1100; });
}

function parseMeteoRow(r: string[]) {
  const pIdx = findPressureIdx(r);
  if (pIdx < 2) return null;
  const ws = parseFloat(r[pIdx + 3] ?? "");
  const wg = parseFloat(r[pIdx + 4] ?? "");
  const wd = parseFloat(r[pIdx + 2] ?? "");
  if (isNaN(ws) || isNaN(wd)) return null;
  const timeCell = r.find((v) => /\d{2}:\d{2}/.test(v)) ?? r[0] ?? "";
  const timePart = (timeCell.match(/(\d{2}:\d{2})$/) ?? [])[1] ?? timeCell;
  return {
    time: timePart,
    temperature: parseFloat(r[pIdx - 3] ?? ""),
    humidity: parseFloat(r[pIdx - 2] ?? ""),
    pressure: parseFloat(r[pIdx] ?? ""),
    winddir: wd,
    windspeed: Math.round(ws * MS_TO_KT * 10) / 10,
    windgust: isNaN(wg) ? null : Math.round(wg * MS_TO_KT * 10) / 10,
  };
}

async function fetchMeteoTech(url: string) {
  const res = await fetch(url, { cache: "no-store", headers: BROWSER_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const html = new TextDecoder("iso-8859-1").decode(await res.arrayBuffer());
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => extractTds(m[1]));
  const dataRows = rows.filter((r) => r.length >= 8 && findPressureIdx(r) >= 2);
  if (!dataRows.length) throw new Error(`no data rows in ${url}`);
  const parsed = parseMeteoRow(dataRows[dataRows.length - 1]);
  if (!parsed) throw new Error(`parse failed for ${url}`);
  return parsed;
}

// ─── Main handler ────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const debug = searchParams.get("debug") === "1";

  if (debug) {
    const results: Record<string, unknown> = {};
    try { results.ims = await fetchImsData(); } catch (e) { results.imsError = String(e); }
    try { results.gist = await fetchGistData(); } catch (e) { results.gistError = String(e); }
    return NextResponse.json(results);
  }

  const errors: string[] = [];

  // Priority 1: GitHub Gist (meteo-tech data via GitHub Actions)
  // Note: GitHub Actions is also blocked by Cloudflare; gist will be stale/missing
  try {
    const data = await fetchGistData();
    return NextResponse.json({ ...data }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (e) { errors.push(`Gist: ${e}`); }

  // Priority 2: IMS XML (Israel Met Service – real station data, accessible from Vercel)
  try {
    const data = await fetchImsData();
    return NextResponse.json({ ...data }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (e) { errors.push(`IMS: ${e}`); }

  // Priority 3: meteo-tech direct (works locally, 403 from cloud)
  for (const url of [METEO_TECH_URL, METEO_DAILY_URL]) {
    try {
      const data = await fetchMeteoTech(url);
      return NextResponse.json(
        { ...data, source: url.includes("eilat_he") ? "meteo-tech" : "meteo-tech-daily" },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    } catch (e) { errors.push(String(e)); }
  }

  // Priority 4: Open-Meteo forecast model (always available, less accurate for Eilat)
  try {
    const params = new URLSearchParams({
      latitude: "29.5577", longitude: "34.9519",
      current: "windspeed_10m,winddirection_10m,windgusts_10m,temperature_2m,relativehumidity_2m,surface_pressure",
      wind_speed_unit: "kn", timezone: "Asia/Jerusalem",
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { cache: "no-store" });
    const raw = await res.json() as { current: Record<string, number> };
    const c = raw.current;
    return NextResponse.json(
      {
        time: c.time, temperature: c.temperature_2m,
        humidity: c.relativehumidity_2m ?? null, pressure: c.surface_pressure ?? null,
        winddir: c.winddirection_10m, windspeed: c.windspeed_10m, windgust: c.windgusts_10m,
        source: "open-meteo-fallback", scrapeErrors: errors,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    return NextResponse.json({ error: "all sources failed", errors, openMeteoError: String(e) }, { status: 502 });
  }
}
