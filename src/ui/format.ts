import { AU_KM } from '../core/units';

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻',
};
const grouped = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 });

export function formatNumber(value: number): string {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1e10 || abs < 1e-3) {
    const [mantissa, exponent] = value.toExponential(4).split('e') as [string, string];
    const power = [...String(Number(exponent))].map((ch) => SUPERSCRIPT[ch] ?? ch).join('');
    return `${Number(mantissa)} × 10${power}`;
  }
  return grouped.format(value);
}

export function formatFact(def: { unit: string }, value: number | string | boolean): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const text = typeof value === 'number' ? formatNumber(value) : value;
  if (!def.unit) return text;
  return def.unit.startsWith('°') ? `${text}${def.unit}` : `${text} ${def.unit}`;
}

export function formatDistanceKm(km: number): string {
  return `${formatNumber(km)} km (${(km / AU_KM).toFixed(4)} AU)`;
}

/** Rounds to the displayed unit first, then splits, so a value never reads "8 min 60 s". */
export function formatLightTime(seconds: number): string {
  if (seconds < 59.95) return `${seconds.toFixed(1)} s`;
  const wholeSeconds = Math.round(seconds);
  if (wholeSeconds < 3600) return `${Math.floor(wholeSeconds / 60)} min ${wholeSeconds % 60} s`;
  const wholeMinutes = Math.round(seconds / 60);
  return `${Math.floor(wholeMinutes / 60)} h ${wholeMinutes % 60} min`;
}

export function formatAu(km: number): string {
  const au = km / AU_KM;
  return `${au < 1 ? au.toFixed(3) : au.toFixed(2)} AU`;
}

/** A distance in kilometres: whole numbers from 1,000 km up, one decimal below. */
export function formatKm(km: number): string {
  return km >= 1000 ? `${Math.round(km).toLocaleString('en-US')} km` : `${km.toFixed(1)} km`;
}

export function formatLightTimeShort(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const min = seconds / 60;
  return min < 10 ? `${min.toFixed(1)} min` : min < 120 ? `${Math.round(min)} min` : `${(min / 60).toFixed(1)} h`;
}

export function formatDuration(hours: number): string {
  const h = Math.abs(hours);
  return h < 48 ? `${formatNumber(Number(h.toFixed(1)))} hours` : `${formatNumber(Number((h / 24).toFixed(1)))} days`;
}

export function formatPeriodDays(days: number): string {
  return days < 730 ? `${formatNumber(Number(days.toFixed(1)))} days` : `${formatNumber(Number((days / 365.25).toFixed(2)))} years`;
}
