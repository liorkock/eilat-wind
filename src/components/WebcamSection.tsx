const WEBCAMS = [
  {
    name: "North Beach",
    location: "Eilat North Beach Area",
    url: "https://www.earthcam.com/world/israel/eilat/",
    live: true,
  },
  {
    name: "Coral Beach",
    location: "Southern Eilat Riviera",
    url: "https://www.eilat.muni.il/en/tourism/webcam",
    live: true,
  },
];

const WIND_RESOURCES = [
  {
    name: "Windguru Eilat",
    description: "Wind model forecasts — popular with kitesurfers",
    url: "https://www.windguru.cz/1268",
    icon: "📊",
  },
  {
    name: "Windy Eilat",
    description: "Interactive wind map with hourly animation",
    url: "https://www.windy.com/?29.558,34.952,11",
    icon: "🌀",
  },
  {
    name: "IMS Eilat",
    description: "Israel Meteorological Service — official forecast",
    url: "https://ims.gov.il/en/eilat",
    icon: "🇮🇱",
  },
  {
    name: "Windyty Eilat",
    description: "Wind & wave conditions",
    url: "https://www.ventusky.com/?p=29.6;34.9;10&l=wind-10m",
    icon: "🌊",
  },
];

export default function WebcamSection() {
  return (
    <section>
      <h2 className="text-xl font-bold text-white mb-4">📷 Webcams & Resources</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {WEBCAMS.map((cam) => (
          <a
            key={cam.name}
            href={cam.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4 hover:bg-slate-800 transition-colors group"
          >
            <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center text-2xl flex-shrink-0 group-hover:bg-slate-700 transition-colors">
              🎥
            </div>
            <div className="min-w-0">
              <div className="font-medium text-white text-sm">{cam.name}</div>
              <div className="text-slate-400 text-xs truncate">{cam.location}</div>
              {cam.live && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                  <span className="text-red-400 text-[10px] font-medium">LIVE</span>
                </div>
              )}
            </div>
            <span className="ml-auto text-slate-600 group-hover:text-slate-400 transition-colors">↗</span>
          </a>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {WIND_RESOURCES.map((r) => (
          <a
            key={r.name}
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col gap-2 bg-slate-900 border border-slate-800 rounded-xl p-3 hover:bg-slate-800 transition-colors"
          >
            <span className="text-2xl">{r.icon}</span>
            <div className="font-medium text-sm text-white">{r.name}</div>
            <div className="text-slate-500 text-xs">{r.description}</div>
          </a>
        ))}
      </div>
    </section>
  );
}
