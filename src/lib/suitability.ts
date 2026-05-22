export type Rating = 'go' | 'marginal' | 'no-go';

export interface Sport {
  id: string;
  name: string;
  emoji: string;
  goMin: number;
  goMax: number;
  marginalLow: number;
  marginalHigh: number;
}

export const SPORTS: Sport[] = [
  { id: 'kite',      name: 'Kitesurfing', emoji: '🪁', goMin: 12, goMax: 30, marginalLow: 8,  marginalHigh: 35 },
  { id: 'windsurf',  name: 'Windsurfing', emoji: '🏄', goMin: 10, goMax: 35, marginalLow: 7,  marginalHigh: 40 },
  { id: 'wing',      name: 'Wingfoil',    emoji: '🦅', goMin: 8,  goMax: 25, marginalLow: 6,  marginalHigh: 30 },
];

export function rate(windspeed: number, sport: Sport): Rating {
  if (windspeed >= sport.goMin && windspeed <= sport.goMax) return 'go';
  if (windspeed >= sport.marginalLow && windspeed <= sport.marginalHigh) return 'marginal';
  return 'no-go';
}

export const RATING_STYLES: Record<Rating, { bg: string; text: string; border: string; label: string }> = {
  'go':       { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40', label: 'GO' },
  'marginal': { bg: 'bg-amber-500/20',   text: 'text-amber-400',   border: 'border-amber-500/40',   label: 'MARGINAL' },
  'no-go':    { bg: 'bg-red-500/20',     text: 'text-red-400',     border: 'border-red-500/40',     label: 'NO-GO' },
};
