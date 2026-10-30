import type { Body } from '../../core/catalog/schema';
import type { BodyDetails } from '../../core/details/schema';
import { formatNumber, subscripts } from '../format';

export interface ChartBar {
  name: string;
  /** Display form, with subscripts ("CO₂"). */
  formula: string;
  value: number;
  unit: '%' | 'ppm' | 'cm⁻³';
  /** log10 of the value on the shared axis: percent is converted to ppm (1 % = 10,000 ppm), per cm³ is used as is. */
  logValue: number;
  /** The value in its source's own unit ("78.08 %", "420 ppm", "40,000 per cm³"). */
  label: string;
  upperLimit: boolean;
  uncertainty: number | null;
  sourceId: string;
}

export interface ChartModel {
  title: string;
  axis: 'ppm' | 'per-cm3';
  bars: ChartBar[];
  ticks: Array<{ value: number; label: string }>;
  note: { text: string; sourceId: string } | null;
}

const PPM_PER_PERCENT = 10_000;

function bar(name: string, formula: string, value: number, unit: ChartBar['unit'], upperLimit: boolean, uncertainty: number | null, sourceId: string): ChartBar {
  const onAxis = unit === '%' ? value * PPM_PER_PERCENT : value;
  const label = unit === '%' ? `${formatNumber(value)} %` : unit === 'ppm' ? `${formatNumber(value)} ppm` : `${formatNumber(value)} per cm³`;
  return { name, formula: subscripts(formula), value, unit, logValue: Math.log10(onAxis), label, upperLimit, uncertainty, sourceId };
}

/** One tick per power of ten, from just below the smallest bar to the next power above the largest. */
function decadeTicks(bars: ChartBar[]): ChartModel['ticks'] {
  const logs = bars.map((b) => b.logValue);
  const lo = Math.ceil(Math.min(...logs)) - 1;
  const hi = Math.max(Math.ceil(Math.max(...logs)), lo + 1);
  const ticks: ChartModel['ticks'] = [];
  for (let e = lo; e <= hi; e++) {
    const value = Number(`1e${e}`);
    ticks.push({ value, label: formatNumber(value) });
  }
  return ticks;
}

function titleFor(body: Body, basis: string, exosphere: boolean): string {
  if (exosphere) return 'Exosphere · particles per cm³ (upper limits)';
  if (body.id === 'sun' || /photosphere/i.test(basis)) return /by number/i.test(basis) ? 'Photosphere · by number' : 'Photosphere';
  return `Atmosphere · ${basis}`;
}

/** The ranked chart for a body's atmosphere, or null when there is nothing to chart (no atmosphere, or the composition is only a note). */
export function compositionModel(body: Body, details: BodyDetails): ChartModel | null {
  const atm = details.atmosphere;
  if (!atm) return null;
  const density = atm.numberDensity ?? [];
  const exosphere = atm.kind === 'exosphere' && density.length > 0;
  const bars = exosphere
    ? density.map((g) => bar(g.name, g.formula, g.amount, g.unit, g.upperLimit, null, g.sourceId))
    : [...atm.major, ...atm.minor].map((g) => bar(g.name, g.formula, g.amount, g.unit, false, g.uncertainty, g.sourceId));
  const charted = bars.filter((b) => b.value > 0); // a zero has no place on a log axis
  if (charted.length === 0) return null;
  charted.sort((a, b) => b.logValue - a.logValue);
  return {
    title: titleFor(body, atm.basis, exosphere),
    axis: exosphere ? 'per-cm3' : 'ppm',
    bars: charted,
    ticks: decadeTicks(charted),
    note: atm.note,
  };
}

/** The strip text: the top two gases, else the cited note, else "No atmosphere". */
export function compositionPreview(model: ChartModel | null, details: BodyDetails, body?: Body): { parts: Array<{ text: string; sourceId?: string }> } {
  if (model) {
    const parts: Array<{ text: string; sourceId?: string }> = [];
    model.bars.slice(0, 2).forEach((b, i) => {
      if (i > 0) parts.push({ text: ' · ' });
      parts.push({ text: `${b.formula} ${b.label}${b.upperLimit ? ' (upper limit)' : ''}`, sourceId: b.sourceId });
    });
    return { parts };
  }
  const note = details.atmosphere?.note;
  if (note) return { parts: [{ text: note.text, sourceId: note.sourceId }] };
  // Cited only when the body's own surface-pressure fact says 0 bar; otherwise the claim has no source and stays plain.
  const pressure = body?.facts.surfacePressureBar;
  return { parts: [pressure && pressure.value === 0 ? { text: 'No atmosphere', sourceId: pressure.sourceId } : { text: 'No atmosphere' }] };
}
