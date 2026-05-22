import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Chaka Wind Forecast",
  description: "Real-time wind data and 16-day forecast for Eilat, Israel. Optimized for kitesurfing, windsurfing, and wingfoiling.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 antialiased">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="text-center text-slate-500 text-xs py-4 border-t border-slate-800">
          Wind data from{" "}
          <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">
            Open-Meteo
          </a>{" "}
          · Updated every 30 min · Eilat, Israel 🇮🇱
        </footer>
      </body>
    </html>
  );
}
