"use client";

interface Props {
  direction: number;
  size?: number;
}

export default function WindCompass({ direction, size = 80 }: Props) {
  return (
    <div
      className="relative flex items-center justify-center rounded-full border-2 border-slate-700 bg-slate-900"
      style={{ width: size, height: size }}
    >
      {/* Cardinal labels */}
      {[
        { label: "N", top: "4px", left: "50%", transform: "translateX(-50%)" },
        { label: "S", bottom: "4px", left: "50%", transform: "translateX(-50%)" },
        { label: "E", right: "4px", top: "50%", transform: "translateY(-50%)" },
        { label: "W", left: "4px", top: "50%", transform: "translateY(-50%)" },
      ].map(({ label, ...style }) => (
        <span
          key={label}
          className="absolute text-[9px] font-bold text-slate-500 leading-none"
          style={style as React.CSSProperties}
        >
          {label}
        </span>
      ))}

      {/* Arrow pointing FROM (wind source direction) */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ transform: `rotate(${direction}deg)` }}
      >
        <svg viewBox="0 0 24 24" className="text-cyan-400" style={{ width: size * 0.45, height: size * 0.45 }}>
          {/* Arrow pointing up = from North */}
          <path
            d="M12 3 L16 13 L12 11 L8 13 Z"
            fill="currentColor"
            opacity="0.9"
          />
          <path
            d="M12 11 L12 21"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            opacity="0.5"
          />
        </svg>
      </div>
    </div>
  );
}
