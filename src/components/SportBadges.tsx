import { SPORTS, rate, RATING_STYLES } from "@/lib/suitability";

interface Props {
  windspeed: number;
  large?: boolean;
}

export default function SportBadges({ windspeed, large }: Props) {
  return (
    <div className={`flex flex-wrap gap-2 ${large ? "gap-3" : ""}`}>
      {SPORTS.map((sport) => {
        const rating = rate(windspeed, sport);
        const styles = RATING_STYLES[rating];
        return (
          <div
            key={sport.id}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${styles.bg} ${styles.border} ${large ? "px-4 py-3" : ""}`}
          >
            <span className={large ? "text-2xl" : "text-lg"}>{sport.emoji}</span>
            <div>
              <div className={`font-medium text-slate-200 ${large ? "text-sm" : "text-xs"}`}>
                {sport.name}
              </div>
              <div className={`font-bold tracking-wide ${styles.text} ${large ? "text-sm" : "text-xs"}`}>
                {styles.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
