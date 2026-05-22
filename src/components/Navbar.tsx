import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.svg" alt="" width={28} height={28} className="rounded-md" />
          <span>Chaka Wind Forecast</span>
        </Link>
        <div className="flex items-center gap-6 text-sm text-slate-400">
          <Link href="/" className="hover:text-white transition-colors">Now</Link>
          <Link href="/forecast" className="hover:text-white transition-colors">16-Day</Link>
          <a
            href="https://www.windy.com/?29.558,34.952,10"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            Windy ↗
          </a>
        </div>
      </div>
    </nav>
  );
}
