"use client";

export default function WindyMap() {
  return (
    <div className="rounded-xl overflow-hidden border border-slate-800">
      <iframe
        title="Windy wind map — Eilat"
        width="100%"
        height="400"
        src="https://embed.windy.com/embed2.html?lat=29.558&lon=34.952&detailLat=29.558&detailLon=34.952&width=650&height=400&panes=1&level=surface&overlay=wind&product=ecmwf&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=true&metricWind=kt&metricTemp=%C2%B0C&radarRange=-1"
        frameBorder="0"
        className="block w-full"
      />
    </div>
  );
}
